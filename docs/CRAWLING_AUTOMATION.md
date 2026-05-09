# 음식점 크롤링 자동화 계획

---

## 현재 스크립트 (수동 실행)

| 스크립트 | 역할 | 실행 명령 |
|---|---|---|
| `crawl_restaurants.py` | 카카오+네이버 교차 검증, restaurants 테이블 upsert | `python crawl_restaurants.py` |
| `crawl_menus.py` | 카카오 플레이스 메뉴 탭 크롤링, menu_items 저장 | `python crawl_menus.py` |
| `tag_menus.py` | GPT-4o로 tags·allergens 자동 분류 | `python tag_menus.py` |

### 초기 전체 실행 순서
```bash
python crawl_restaurants.py   # 1. 음식점 수집
python crawl_menus.py         # 2. 메뉴 수집
python tag_menus.py           # 3. 태그 자동 분류
```

---

## 주간 업데이트 워크플로우 (목표)

매주 1회 실행하여 DB를 최신 상태로 유지합니다.

### 처리 항목
1. **신규 음식점 추가** — 카카오 API에서 새로 등록된 가게 감지 → INSERT
2. **폐업 음식점 처리** — 카카오 API 결과에서 사라진 가게 → `is_active = false`
3. **메뉴 변경 감지** — 기존 메뉴와 크롤링 결과 비교 → 변경된 가게만 메뉴 재수집
4. **신규 메뉴 태깅** — 새로 추가된 메뉴만 GPT 태깅

### 구현 예정: `scripts/weekly_update.py`

```
[weekly_update.py 실행]
    ↓
1. 카카오 API 전체 수집 (crawl_restaurants.py 로직 재사용)
    ↓
2. 기존 restaurants 목록과 비교
   - 신규 (kakao_id 없음)   → INSERT + 메뉴 크롤링 + 태깅
   - 기존 (kakao_id 있음)   → 메뉴 변경 여부 확인
   - 사라짐 (API에 없음)    → is_active = false
    ↓
3. 메뉴 변경된 가게만 재크롤링 (crawl_menus.py 로직 재사용)
    ↓
4. 신규 메뉴만 GPT 태깅 (tag_menus.py 로직 재사용)
    ↓
5. 결과 요약 로그 출력
```

### 메뉴 변경 감지 기준
- 기존 메뉴 수 vs 새 크롤링 메뉴 수 차이가 있을 때
- 메뉴명 집합(set) 비교 — 추가/삭제된 항목 감지

---

## n8n 자동화 연동 계획

`weekly_update.py` 완성 후 n8n Schedule Trigger로 자동 실행.

```
[Schedule Trigger] 매주 월요일 오전 3시
    ↓
[Execute Command 노드] python weekly_update.py
    ↓
[Discord Webhook] 업데이트 결과 알림
  예) "탕정 음식점 업데이트 완료: 신규 3개, 폐업 1개, 메뉴 변경 5개"
```

---

## TODO

- [ ] `scripts/weekly_update.py` 구현
- [ ] `restaurants` 테이블에 `kakao_id` 컬럼 추가 (폐업 감지용 고유키)
- [ ] n8n Execute Command 워크플로우 구성
- [ ] food_feedback vs restaurant_log 중복 여부 검토 후 통합
- [ ] menu_items calories 필드 채우기 (식약처 API 연동)
