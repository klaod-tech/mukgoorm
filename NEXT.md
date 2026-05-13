# 다음 작업 목록

> 최종 업데이트: 2026-05-14
> 브랜치: `exp`

---

## 완료된 작업 (n8n)

| 항목 | 상태 |
|---|---|
| 날씨 webhook (sky/rain 추출, 응답 포맷) | ✅ |
| 식사 webhook | ✅ |
| 일기 webhook (is_update boolean 오류 수정) | ✅ |
| 일정 webhook (Agent 중복 실행 수정) | ✅ |
| 체중 webhook (메시지 직접 분석) | ✅ |
| 음식추천 A경로 | ✅ |
| 음식추천 B경로 (Decision 노드 메시지 변수 수정) | ✅ |
| 음식추천 C경로 (5개 랜덤 선택 + Loop + restaurant_log 저장) | ✅ |

---

## 내일 작업 계획

### Phase 1 — React ↔ n8n 연결

#### 1-1. `recommendFood` 함수에 date 추가
파일: [web/src/lib/n8n.ts](web/src/lib/n8n.ts)

```typescript
export async function recommendFood(params: {
  user_id: string
  message: string
  location?: string
  date?: string        // 추가
}): Promise<FoodRecommendResponse>
```

호출 시:
```typescript
recommendFood({
  user_id,
  message,
  location,
  date: new Date().toISOString().slice(0, 10),
})
```

#### 1-2. n8n webhook URL 설정
- `.env.local`에 n8n base URL 확인 (`http://localhost:5678`)
- `vite.config.ts` proxy 설정 확인 (이미 완료)

#### 1-3. 각 기능별 webhook 연동 확인
- 채팅 입력 → `classifyMessage` → `dispatchToWebhooks` 흐름 연결
- 음식추천은 `recommendFood` 별도 호출

---

### Phase 2 — 채팅 UI 구현

#### 2-1. 메시지 입력 → 분류 → 전송 흐름
```
사용자 메시지 입력
  → classifyMessage (GPT 분류)
  → dispatchToWebhooks (n8n 병렬 호출)
  → synthesizeResponse (GPT 합성)
  → 채팅창에 응답 표시
```

#### 2-2. 응답 카드 렌더링
- `restaurants` 배열 → 식당 카드 컴포넌트
- `weather` 배열 → 날씨 카드 컴포넌트
- 로딩 상태 처리 (각 webhook 응답 대기)

#### 2-3. 음식추천 전용 UI
- A/B/C 경로별 응답 처리
- 식당 카드에 추천 이유(`reason`) 표시
- 알레르기 주의 표시

---

### Phase 3 — 실제 실행 테스트

#### 3-1. 전체 플로우 end-to-end 테스트
순서:
1. React에서 메시지 입력
2. n8n webhook 호출 확인 (Network 탭)
3. Supabase 데이터 저장 확인
4. 응답 카드 렌더링 확인

#### 3-2. 각 시나리오 테스트
- "오늘 날씨 어때?" → 날씨 카드
- "점심에 삼겹살 먹었어" → 식사 저장
- "짬뽕 먹고 싶어" → 음식추천 B경로
- "오늘 뭐 먹지?" → 음식추천 C경로 (5개 랜덤)
- "내일 3시에 치과 예약" → 일정 저장
- "오늘 58kg" → 체중 저장

#### 3-3. 에러 케이스 처리
- n8n 타임아웃 시 UI 처리
- 분류 실패 시 fallback 메시지

---

### Phase 4 — 미결 사항

#### n8n
- [ ] `새 날씨 등록` 노드 수정 (city 소스, created_at 값 확인)
- [ ] 음식추천 C경로 알레르기 없는 식당 메뉴 데이터 채우기 (Supabase menu_items)
- [ ] 이메일 webhook 연동
- [ ] **음식추천 A/B/C 경로 메뉴 조회 구조 수정** (아래 상세 참고)

#### 음식추천 메뉴 조회 구조 수정 상세

**문제**: `5개 출력` 노드가 Decision **이전** 메인 흐름에 있어서 A/B 경로도 랜덤 5개 식당의 메뉴만 조회됨. 유저가 언급한 식당/메뉴가 그 5개 안에 없으면 조회 불가.

**현재 잘못된 구조:**
```
식당1 (45개) → 5개 출력 (랜덤 5개) → 메뉴1 → Decision → A/B/C
```

**수정 목표 구조:**
```
식당1 (45개) → Decision → A경로: 언급된 식당 ID로 메뉴 직접 조회
                        → B경로: 키워드로 menu_items 전체 텍스트 검색
                        → C경로: 5개 출력 → 메뉴1 → Food AI
```

**수정 작업:**
1. `5개 출력` + `메뉴1` 노드를 메인 흐름에서 분리 → C경로 분기 이후로 이동
2. A경로: 식당명 추출 → 해당 restaurant_id로 메뉴 조회
3. B경로: 키워드로 menu_items 텍스트 검색 (Supabase `ilike` 또는 `fts`)
4. C경로: 기존 `5개 출력` → `메뉴1` 구조 유지

#### React
- [ ] Supabase Auth 로그인
- [ ] 온보딩 플로우 (취향, 알레르기 입력)
- [ ] 체중 추이 그래프 (recharts)
- [ ] 주간 리포트 페이지

---

## 미결 사항 (장기)

```
[ ] Supabase RLS 정책 설계 (유저별 데이터 격리)
[ ] PWA vs Electron 패키징 방향 결정
[ ] 이메일 모니터링 IMAP 처리 위치 확정 (Edge Function vs n8n)
[ ] ML 의도 분류 파이프라인 (데이터 50건+ 누적 후)
```
