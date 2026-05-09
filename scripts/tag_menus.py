#!/usr/bin/env python3
"""
GPT-4o-mini 기반 메뉴 자동 태깅 스크립트
menu_items 테이블의 tags, allergens 필드를 자동으로 채웁니다.

사용법:
  python tag_menus.py              # 태그 없는 메뉴 전체
  python tag_menus.py --limit 10  # 앞 10개만 테스트
  python tag_menus.py --retag     # 이미 태깅된 것 포함 전체 재태깅
"""

import os
import sys
import json
import time
import argparse
import requests
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
OPENAI_KEY   = os.getenv("OPENAI_API_KEY")

client = OpenAI(api_key=OPENAI_KEY)

# 태그 카테고리 가이드 (GPT 프롬프트에 포함)
TAG_GUIDE = """
카테고리(하나 이상 선택):
  육류, 해산물, 채식, 면류, 밥류, 국물류, 음료, 디저트, 분식, 빵/샌드위치

조리법(해당하면 선택):
  구이, 튀김, 찜, 볶음, 국물, 날것

상황(해당하면 선택):
  혼밥가능, 2인이상, 술안주, 점심특선, 세트메뉴

알레르기 항목(성분 추론):
  돼지고기, 소고기, 닭고기, 생선, 갑각류, 계란, 유제품, 밀(글루텐), 견과류, 대두
"""

SYSTEM_PROMPT = f"""당신은 한국 음식점 메뉴 분류 전문가입니다.
메뉴 목록을 받으면 각 메뉴에 대해 tags와 allergens를 JSON으로 반환하세요.

태그 가이드:
{TAG_GUIDE}

중요 규칙:
- restaurant_name(음식점 이름)을 최우선 맥락으로 활용하세요.
  예) "베스킨라빈스" → 모든 메뉴는 "디저트","아이스크림" / "스타벅스" → "음료","카페"
- 메뉴명만으로 판단하지 말고 음식점 업종과 이름을 함께 고려하세요.
- tags: 3~6개, 문자열 배열 (가이드 외 적절한 태그 추가 가능: 아이스크림, 피자, 스시 등)
- allergens: 성분을 이름에서 추론, 확실하지 않으면 빈 배열
- 반드시 아래 형식의 JSON 객체만 반환 (설명 없이)
- 형식: {{"results":[{{"id":"uuid","tags":["태그1","태그2"],"allergens":["성분1"]}}]}}
"""


# ── Supabase 헬퍼 ─────────────────────────────────────────────

def sb_headers():
    return {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "application/json",
    }


def fetch_menus(limit: int | None, retag: bool = False) -> list[dict]:
    """메뉴 아이템 조회 — restaurant 이름·카테고리 포함"""
    url = f"{SUPABASE_URL}/rest/v1/menu_items"
    params = {
        "select": "id,menu_name,description,restaurants(name,category)",
    }
    if not retag:
        params["tags"] = "is.null"
    if limit:
        params["limit"] = limit

    res = requests.get(url, headers=sb_headers(), params=params)
    res.raise_for_status()
    return res.json()


def update_menu(menu_id: str, tags: list[str], allergens: list[str]):
    """menu_items 행 업데이트"""
    url = f"{SUPABASE_URL}/rest/v1/menu_items"
    params = {"id": f"eq.{menu_id}"}
    body = {"tags": tags, "allergens": allergens}
    requests.patch(url, headers=sb_headers(), params=params, json=body)


# ── GPT 태깅 ─────────────────────────────────────────────────

def build_user_message(batch: list[dict]) -> str:
    items = []
    for m in batch:
        rest_name = ""
        rest_cat  = ""
        if m.get("restaurants"):
            rest_name = m["restaurants"].get("name", "") or ""
            rest_cat  = m["restaurants"].get("category", "") or ""
        menu_name = m["menu_name"]
        desc      = m.get("description") or ""
        items.append(
            f'{{"id":"{m["id"]}",'
            f'"restaurant_name":"{rest_name}",'
            f'"restaurant_category":"{rest_cat}",'
            f'"name":"{menu_name}",'
            f'"desc":"{desc}"}}'
        )
    return "[" + ",".join(items) + "]"


def gpt_tag_batch(batch: list[dict]) -> list[dict]:
    """GPT-4o-mini로 배치 태깅, 파싱 실패 시 빈 결과 반환"""
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": build_user_message(batch)},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content

        # response_format=json_object 는 최상위 객체를 반환하므로 배열을 꺼냄
        parsed = json.loads(raw)
        # {"results": [...]} 형태
        for v in parsed.values():
            if isinstance(v, list):
                return v

    except Exception as e:
        print(f"    [GPT 오류] {e}")

    return []


# ── 메인 ──────────────────────────────────────────────────────

def main(limit: int | None, retag: bool = False):
    print("=" * 50)
    print("  메뉴 자동 태깅 시작 (GPT-4o-mini)")
    if retag:
        print("  모드: 전체 재태깅")
    print("=" * 50)

    menus = fetch_menus(limit, retag)
    print(f"\n대상 메뉴: {len(menus)}개\n")

    if not menus:
        print("태깅할 메뉴가 없습니다.")
        return

    batch_size = 20  # GPT 1회 호출당 메뉴 수
    total_tagged = 0

    for i in range(0, len(menus), batch_size):
        batch = menus[i : i + batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(menus) + batch_size - 1) // batch_size

        print(f"[배치 {batch_num}/{total_batches}] {len(batch)}개 처리 중...", end=" ", flush=True)

        results = gpt_tag_batch(batch)

        # id 기준으로 매핑
        result_map = {r["id"]: r for r in results if "id" in r}

        updated = 0
        for m in batch:
            mid = m["id"]
            if mid in result_map:
                r = result_map[mid]
                tags      = r.get("tags", []) or []
                allergens = r.get("allergens", []) or []
                update_menu(mid, tags, allergens)
                updated += 1

        total_tagged += updated
        print(f"{updated}개 태깅 완료")

        time.sleep(0.5)  # API rate limit

    print(f"\n{'=' * 50}")
    print(f"  완료: 총 {total_tagged}/{len(menus)}개 태깅")
    print("=" * 50)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--retag", action="store_true", help="이미 태깅된 항목 포함 재태깅")
    args = parser.parse_args()
    main(args.limit, args.retag)
