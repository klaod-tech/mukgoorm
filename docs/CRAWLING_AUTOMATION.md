# 음식점 크롤링 자동화 계획

현재 `scripts/crawl_restaurants.py`는 수동 실행 전용입니다.  
아래 계획에 따라 **n8n 기반 주 1회 자동화**로 전환 예정입니다.

---

## 현재 상태 (수동)

```bash
cd scripts
pip install -r requirements.txt
python crawl_restaurants.py
```

- 카카오 로컬 API → 네이버 지역 API 교차 검증 → Supabase `restaurants` 테이블 upsert
- 실행 시마다 `scripts/crawl_result.json` 백업 생성

---

## 자동화 구현 계획 (n8n)

### 트리거
- **Schedule Trigger** 노드: 매주 월요일 오전 3시 (KST)

### 워크플로우 흐름

```
[Schedule Trigger]
      ↓
[HTTP Request] — 카카오 로컬 API
  POST https://dapi.kakao.com/v2/local/search/keyword.json
  파라미터: query=음식점, x=127.0788, y=36.7939, radius=3000, category_group_code=FD6
      ↓
[Code 노드] — 페이지네이션 처리 + 데이터 정규화
      ↓
[HTTP Request] — 네이버 지역 API (음식점별 교차 검증)
  루프: SplitInBatches → HTTP Request → Merge
      ↓
[Code 노드] — 데이터 병합 + Supabase 저장 포맷 변환
      ↓
[Supabase 노드] — restaurants 테이블 Upsert
  on_conflict: name, address
      ↓
[Discord Webhook] — 완료 알림 (수집 건수 포함)
```

### 구현 시 참고 사항

1. **카카오 API 페이지네이션**  
   n8n의 `Loop Over Items` + `SplitInBatches` 조합으로 처리.  
   `meta.is_end == true`일 때 루프 종료.

2. **네이버 API Rate Limit**  
   `Wait` 노드를 추가해 요청 간 0.15초 지연.

3. **Supabase Upsert**  
   `restaurants_schema.sql`에 `UNIQUE (name, address)` 제약이 있어야 동작.  
   Supabase 노드 → Operation: Upsert / Conflict Column: `name,address`

4. **환경변수**  
   n8n Credentials에 등록:
   - `KAKAO_REST_API_KEY`
   - `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET`
   - Supabase credential (URL + Service Key)

### 예상 소요 시간
- 탕정 지역 음식점 약 200~400개 기준, 네이버 교차 검증 포함 **약 3~5분**

---

## TODO

- [ ] n8n 워크플로우 JSON 작성 후 `/n8n/crawl_restaurants_weekly.json`으로 저장
- [ ] food_feedback 테이블과 restaurant_log 테이블 역할 중복 여부 검토 후 통합
- [ ] menu_items 테이블 채우기 방안 결정 (수동 입력 vs 배달앱 API)
- [ ] open_hours, price_range 필드 수집 방안 결정
  - 카카오 Place Detail API (`/v2/local/place/detail.json`) 로 영업시간 보완 가능
