#!/usr/bin/env python3
"""
탕정 지역 음식점 크롤링 스크립트
카카오 로컬 API + 네이버 지역 검색 API 교차 검증 후 Supabase 저장

사용법:
  cd scripts
  pip install -r requirements.txt
  python crawl_restaurants.py

필요 환경변수 (.env):
  KAKAO_REST_API_KEY    카카오 REST API 키 (카카오 개발자 콘솔)
  NAVER_CLIENT_ID       네이버 검색 API Client ID
  NAVER_CLIENT_SECRET   네이버 검색 API Client Secret
  SUPABASE_URL          https://<project-ref>.supabase.co
  SUPABASE_SERVICE_KEY  Supabase Service Role Key (Settings > API)
"""

import os
import re
import sys
import json
import time
import requests
from pathlib import Path
from dotenv import load_dotenv

# 프로젝트 루트의 .env 로드
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

KAKAO_KEY    = os.getenv("KAKAO_REST_API_KEY")
NAVER_ID     = os.getenv("NAVER_CLIENT_ID")
NAVER_SECRET = os.getenv("NAVER_CLIENT_SECRET")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# 탕정면 행정복지센터 기준 좌표
TANGJEONG_LON = 127.0788  # x (경도)
TANGJEONG_LAT = 36.7939   # y (위도)
SEARCH_RADIUS = 3000       # 3km 반경


# ── 유틸 ──────────────────────────────────────────────────────

def normalize(name: str) -> str:
    """이름 정규화 — 교차 검증용 비교에 사용"""
    name = re.sub(r"<[^>]+>", "", name)           # HTML 태그 제거 (네이버 API)
    name = re.sub(r"[^가-힣a-zA-Z0-9]", "", name)  # 특수문자·공백 제거
    return name.lower()


def extract_category(kakao_category: str) -> str:
    """'음식점 > 한식 > 국밥' → '국밥' (최하위 항목만 추출)"""
    parts = [p.strip() for p in kakao_category.split(">")]
    # '음식점' 최상위는 제거하고, 두 번째 항목부터 최하위까지
    meaningful = [p for p in parts if p not in ("음식점", "")]
    return meaningful[-1] if meaningful else ""


# ── 1. 카카오 로컬 API ────────────────────────────────────────

def fetch_kakao() -> list[dict]:
    """카카오 로컬 키워드 검색으로 탕정 음식점 전체 수집"""
    url = "https://dapi.kakao.com/v2/local/search/keyword.json"
    headers = {"Authorization": f"KakaoAK {KAKAO_KEY}"}
    results = []

    # 카카오 API 한계: 최대 45페이지 × 15개 = 675개
    for page in range(1, 46):
        params = {
            "query": "음식점",
            "x": TANGJEONG_LON,
            "y": TANGJEONG_LAT,
            "radius": SEARCH_RADIUS,
            "category_group_code": "FD6",
            "page": page,
            "size": 15,
        }
        res = requests.get(url, headers=headers, params=params, timeout=10)

        if res.status_code != 200:
            print(f"  [카카오 오류] {res.status_code}: {res.text[:200]}")
            break

        data = res.json()
        docs = data.get("documents", [])
        if not docs:
            break

        for d in docs:
            results.append({
                "kakao_id": d["id"],
                "name":     d["place_name"],
                "category": extract_category(d.get("category_name", "")),
                "address":  d.get("road_address_name") or d.get("address_name", "") or None,
                "phone":    d.get("phone") or None,
                "link":     d.get("place_url") or None,
            })

        if data["meta"]["is_end"]:
            break

        time.sleep(0.1)

    return results


# ── 2. 네이버 지역 검색 API (교차 검증·보완) ─────────────────

def naver_lookup(name: str) -> dict | None:
    """
    특정 음식점 이름으로 네이버 지역 API 조회.
    이름이 매칭되면 전화번호·카테고리 등 보완 데이터 반환.
    """
    url = "https://openapi.naver.com/v1/search/local.json"
    headers = {
        "X-Naver-Client-Id":     NAVER_ID,
        "X-Naver-Client-Secret": NAVER_SECRET,
    }
    params = {"query": f"아산 탕정 {name}", "display": 5}

    try:
        res = requests.get(url, headers=headers, params=params, timeout=10)
    except requests.RequestException:
        return None

    if res.status_code != 200:
        return None

    items = res.json().get("items", [])
    norm = normalize(name)

    for item in items:
        item_norm = normalize(item.get("title", ""))
        # 이름이 일치하거나 포함 관계일 때 매칭
        if norm == item_norm or norm in item_norm or item_norm in norm:
            return {
                "phone":    item.get("telephone") or None,
                "category": item.get("category") or None,
                "link":     item.get("link") or None,
            }

    return None


# ── 3. Supabase 저장 ──────────────────────────────────────────

def save_to_supabase(rows: list[dict]) -> int:
    """
    restaurants 테이블에 UPSERT.
    (name, address) UNIQUE 제약 기준으로 중복 시 기존 행 업데이트.
    """
    endpoint = f"{SUPABASE_URL}/rest/v1/restaurants?on_conflict=name,address"
    headers = {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "resolution=merge-duplicates,return=minimal",
    }

    total = 0
    batch_size = 50  # 한 번에 너무 많으면 타임아웃 위험

    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        res = requests.post(endpoint, headers=headers, json=batch, timeout=15)

        if res.status_code in (200, 201, 204):
            total += len(batch)
            print(f"  배치 {i // batch_size + 1}: {len(batch)}개 저장 완료")
        else:
            print(f"  [Supabase 오류] 배치 {i // batch_size + 1}: "
                  f"{res.status_code} - {res.text[:300]}")

    return total


# ── 메인 ──────────────────────────────────────────────────────

def check_env() -> bool:
    required = {
        "KAKAO_REST_API_KEY": KAKAO_KEY,
        "NAVER_CLIENT_ID":    NAVER_ID,
        "NAVER_CLIENT_SECRET": NAVER_SECRET,
        "SUPABASE_URL":       SUPABASE_URL,
        "SUPABASE_SERVICE_KEY": SUPABASE_KEY,
    }
    missing = [k for k, v in required.items() if not v]
    if missing:
        print(f"[오류] .env에 다음 키가 없습니다: {', '.join(missing)}")
        return False
    return True


def main():
    if not check_env():
        sys.exit(1)

    print("=" * 50)
    print("  탕정 음식점 크롤링 시작")
    print(f"  중심 좌표: {TANGJEONG_LAT}, {TANGJEONG_LON}")
    print(f"  반경: {SEARCH_RADIUS // 1000}km")
    print("=" * 50)

    # ── Step 1: 카카오 수집
    print("\n[1/4] 카카오 로컬 API 수집 중...")
    kakao_list = fetch_kakao()
    print(f"  → {len(kakao_list)}개 수집 완료")

    # ── Step 2: 네이버 교차 검증
    print("\n[2/4] 네이버 API 교차 검증 중...")
    verified = 0

    for i, r in enumerate(kakao_list):
        naver = naver_lookup(r["name"])
        if naver:
            # 카카오에 없는 정보를 네이버로 보완
            if not r["phone"] and naver.get("phone"):
                r["phone"] = naver["phone"]
            if not r["category"] and naver.get("category"):
                r["category"] = naver["category"]
            if not r["link"] and naver.get("link"):
                r["link"] = naver["link"]
            r["naver_verified"] = True
            verified += 1
        else:
            r["naver_verified"] = False

        if (i + 1) % 20 == 0:
            print(f"  {i + 1}/{len(kakao_list)} 처리 중...")

        time.sleep(0.15)  # 네이버 API rate limit

    print(f"  → 교차 검증: {verified}/{len(kakao_list)}개 네이버에서 확인됨")

    # ── Step 3: 저장용 포맷 변환
    print("\n[3/4] Supabase에 저장 중...")
    rows = [
        {
            "name":         r["name"],
            "category":     r.get("category") or None,
            "address":      r.get("address") or None,
            "phone":        r.get("phone") or None,
            "link":         r.get("link") or None,
            "location_tag": "탕정",
            "is_active":    True,
            # open_hours, price_range: 지도 API에서 제공하지 않음 → NULL
        }
        for r in kakao_list
    ]

    saved = save_to_supabase(rows)
    print(f"  → 총 {saved}개 저장 완료")

    # ── Step 4: JSON 백업
    out_path = Path(__file__).parent / "crawl_result.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(kakao_list, f, ensure_ascii=False, indent=2)

    print(f"\n[4/4] 결과 백업: {out_path}")
    print("\n" + "=" * 50)
    print(f"  완료: {len(kakao_list)}개 수집 / {saved}개 저장")
    print("=" * 50)


if __name__ == "__main__":
    main()
