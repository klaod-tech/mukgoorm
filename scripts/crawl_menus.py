#!/usr/bin/env python3
"""
카카오 맵 메뉴 크롤링 스크립트
Supabase의 restaurants 테이블에서 링크를 읽어 메뉴 탭을 크롤링 후 menu_items에 저장

사용법:
  python crawl_menus.py              # 전체 음식점
  python crawl_menus.py --limit 5   # 앞 5개만 테스트
"""

import os
import sys
import json
import time
import asyncio
import argparse
import requests
from pathlib import Path
from dotenv import load_dotenv
from playwright.async_api import async_playwright, TimeoutError as PWTimeout

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")


# ── Supabase 헬퍼 ─────────────────────────────────────────────

def sb_headers():
    return {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "application/json",
    }


def fetch_restaurants(limit: int | None = None) -> list[dict]:
    """link가 있는 음식점 목록 조회"""
    url = f"{SUPABASE_URL}/rest/v1/restaurants"
    params = {
        "select": "id,name,link",
        "link": "not.is.null",
        "is_active": "eq.true",
    }
    if limit:
        params["limit"] = limit

    res = requests.get(url, headers=sb_headers(), params=params)
    res.raise_for_status()
    return res.json()


def delete_existing_menus(restaurant_id: str):
    """기존 메뉴 삭제 (재크롤링 시 중복 방지)"""
    url = f"{SUPABASE_URL}/rest/v1/menu_items"
    params = {"restaurant_id": f"eq.{restaurant_id}"}
    requests.delete(url, headers=sb_headers(), params=params)


def save_menus(restaurant_id: str, menus: list[dict]) -> int:
    """menu_items 테이블에 INSERT"""
    if not menus:
        return 0

    url = f"{SUPABASE_URL}/rest/v1/menu_items"
    rows = [
        {
            "restaurant_id": restaurant_id,
            "menu_name":     m["name"],
            "price":         m.get("price"),
            "description":   m.get("description"),
            "is_available":  True,
        }
        for m in menus
    ]

    res = requests.post(url, headers=sb_headers(), json=rows)
    return len(rows) if res.status_code in (200, 201) else 0


# ── 카카오 메뉴 크롤링 ────────────────────────────────────────

def parse_price(text: str) -> int | None:
    """'7,000원' → 7000"""
    digits = "".join(c for c in text if c.isdigit())
    return int(digits) if digits else None


async def scrape_menus(page, url: str) -> list[dict]:
    """카카오 플레이스 페이지에서 메뉴 목록 추출"""
    try:
        await page.goto(url, wait_until="networkidle", timeout=20000)
        await page.wait_for_timeout(1000)
    except PWTimeout:
        return []

    # 메뉴 탭 클릭 — skip nav의 "메뉴 바로가기"를 피하고 정확히 "메뉴" 탭만 클릭
    try:
        await page.evaluate("""
            const tabs = Array.from(document.querySelectorAll('a, button'));
            const menuTab = tabs.find(t =>
                t.textContent.trim() === '메뉴' &&
                !t.getAttribute('href')?.includes('#gnbContent')
            );
            if (menuTab) menuTab.click();
        """)
        await page.wait_for_timeout(1500)
    except Exception:
        pass

    menus = []

    try:
        # 실제 카카오 플레이스 HTML 구조 기반 선택자
        name_els  = await page.query_selector_all("strong.tit_item")
        price_els = await page.query_selector_all("p.desc_item")
        desc_els  = await page.query_selector_all("p.desc_item2")

        for i, name_el in enumerate(name_els):
            name  = (await name_el.inner_text()).strip()
            price = parse_price(await price_els[i].inner_text()) if i < len(price_els) else None
            desc  = (await desc_els[i].inner_text()).strip() if i < len(desc_els) else None

            if name:
                menus.append({"name": name, "price": price, "description": desc or None})

    except Exception:
        pass

    # 선택자 실패 시 정규식 대체
    if not menus:
        try:
            content = await page.content()
            menus = fallback_parse(content)
        except Exception:
            pass

    return menus


def fallback_parse(html: str) -> list[dict]:
    """HTML 텍스트에서 메뉴명·가격 패턴을 정규식으로 추출 (최후 수단)"""
    import re
    menus = []

    # '메뉴명\n가격원' 패턴 매칭
    pattern = re.compile(r'([가-힣a-zA-Z0-9\s\(\)·\/\+&]+?)\s*[\n\r]+\s*(\d[\d,]+)원')
    for m in pattern.finditer(html):
        name = m.group(1).strip()
        price = parse_price(m.group(2))
        if name and len(name) < 50:
            menus.append({"name": name, "price": price, "description": None})

    return menus[:30]  # 최대 30개


# ── 메인 ──────────────────────────────────────────────────────

async def main(limit: int | None):
    print("=" * 50)
    print("  카카오 메뉴 크롤링 시작")
    print("=" * 50)

    # 1. 음식점 목록 조회
    restaurants = fetch_restaurants(limit)
    print(f"\n대상 음식점: {len(restaurants)}개\n")

    total_menus = 0
    results = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        page = await context.new_page()

        for i, r in enumerate(restaurants):
            name = r["name"]
            link = r.get("link")

            if not link:
                print(f"  [{i+1}/{len(restaurants)}] {name} — 링크 없음, 스킵")
                continue

            print(f"  [{i+1}/{len(restaurants)}] {name} 크롤링 중...", end=" ", flush=True)

            menus = await scrape_menus(page, link)

            if menus:
                delete_existing_menus(r["id"])
                saved = save_menus(r["id"], menus)
                total_menus += saved
                print(f"{saved}개 메뉴 저장")
            else:
                print("메뉴 없음")

            results.append({"restaurant": name, "menu_count": len(menus)})
            await asyncio.sleep(0.5)

        await browser.close()

    # 결과 저장
    out_path = Path(__file__).parent / "crawl_menus_result.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n{'=' * 50}")
    print(f"  완료: 총 {total_menus}개 메뉴 저장")
    print(f"  결과 백업: {out_path}")
    print("=" * 50)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="테스트용 음식점 수 제한")
    args = parser.parse_args()
    asyncio.run(main(args.limit))
