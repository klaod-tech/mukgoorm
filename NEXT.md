# 다음 작업 목록

> 최종 업데이트: 2026-05-20  
> 브랜치: `feat/web-migration`

---

## ✅ 완료된 작업

### n8n (먹구름_봇v2)
| 항목 | 상태 |
|---|---|
| 날씨 webhook | ✅ |
| 식사 webhook | ✅ |
| 일기 webhook | ✅ |
| 일정 webhook | ✅ |
| 체중 webhook | ✅ |
| 음식추천 A/B/C 경로 (Softmax 정렬) | ✅ |
| 피드백 로짓 ±0.2 (Step 2) | ✅ |
| B/C 경로 응답에 menus 포함 (Step 3-1) | ✅ |

### React
| 항목 | 상태 |
|---|---|
| 피드백 버튼 UI (선택 시 glow 효과, 중복 클릭 방지) | ✅ |
| `sendFeedback` → POST body에서 `reaction` 키로 변환 | ✅ |
| `Restaurant` interface에 `menus?: MenuItem[]` 추가 (Step 3-2) | ✅ |
| `fetchRestaurantMenu` 제거 → `restaurant.menus` 직접 사용 (Step 3-2) | ✅ |
| `allergens` 제거 → `keywords` 블루 태그로 교체 (`Home.tsx`) | ✅ |
| `Onboarding.tsx` — 알레르기 UI 전체 제거 | ✅ |
| `Settings.tsx` — 알레르기 UI 전체 제거 | ✅ |

### Supabase
| 항목 | 상태 |
|---|---|
| `food_feedback` 테이블에 `restaurant_id` 컬럼 추가 | ✅ |
| `user_preference_logits` 온보딩 시 0으로 초기화 | ✅ |
| `menu_items.allergens` — 사용 중단 (dead column 유지) | ✅ |
| `menu_items.keywords text[]` 컬럼 추가 | ✅ |
| 전체 메뉴 약 703개 키워드 입력 완료 | ✅ |

---

## 🔲 다음 작업 — 내일 노트북에서 진행 (n8n)

> 상세 가이드: [docs/guide/n8n_ml_nodes.md](docs/guide/n8n_ml_nodes.md)

### [우선순위 1] Step 3-3 — n8n: `/food/select` webhook 추가 (로짓 +0.1)

`먹구름_봇v2` 캔버스에 추가할 흐름:

```
메뉴 선택 입력 (Webhook - path: food/select)
    → 방문 기록 저장 (Supabase Create - restaurant_log)
    → 메뉴선택 현재 로짓 (Supabase Get Many - user_preference_logits)
    → 메뉴선택 로짓 계산 (Code - keywords→category 매핑 + +0.1)
    → 로짓 업데이트 (Supabase Update - user_preference_logits)
    → 선택 완료 출력 (Respond to Webhook)
```

**핵심 변경사항 (기존 가이드 대비):**
- React가 `category` 대신 `keywords: string[]` 를 body에 포함해서 전송
- n8n Code 노드에서 `keywords → LOGIT_CATEGORY` 매핑 처리
- 음료/주류/뷔페 키워드(`소주`, `맥주`, `뷔페` 등)는 logit 업데이트 건너뜀

상세 설정 → [docs/guide/n8n_03_메뉴선택_로짓.md](docs/guide/n8n_03_메뉴선택_로짓.md)

---

### [우선순위 2] Step 4 — 월드컵 webhook 추가 (먹구름_봇v2)

```
월드컵 입력 (Webhook - path: worldcup)
    → 현재 로짓 (Supabase Get Many)
    → 월드컵 계산 (Code - 델타 누적 + Softmax)
    → 세션 저장 (HTTP Request - worldcup_sessions)
    → 로짓 저장 (HTTP Request - user_preference_logits upsert)
    → 최종 응답 (Code)
    → 응답 (Respond to Webhook)
```

**핵심 사항:**
- 월드컵 페어 구성 시 `keywords`에 음료/뷔페(`소주`, `맥주`, `뷔페` 등) 포함 메뉴 제외
- React Worldcup 페이지에서 `menu.keywords → category` 매핑 후 rounds 데이터 구성
- 매핑 테이블은 n8n_03, n8n_04 가이드 참고

상세 설정 → [docs/guide/n8n_04_worldcup.md](docs/guide/n8n_04_worldcup.md)

---

### [우선순위 3] Step 5 — 테스트 및 검증

```
[ ] 음식 추천 → 식당 카드 클릭 → 메뉴 패널 표시 확인
[ ] 메뉴 선택 → user_preference_logits logit +0.1 확인
[ ] 피드백 👍 → logit +0.2 확인
[ ] 피드백 👎 → logit -0.2 확인
[ ] 월드컵 완료 → worldcup_sessions 저장 + logit 업데이트 확인
[ ] 음식 추천 → Softmax 정렬 반영 확인 (피드백 후 재추천 시 변화)
```

---

## 미결 사항 (장기)

```
[ ] n8n Railway 배포 (팀 공유 인스턴스)
[ ] Supabase RLS 정책 설계 (유저별 데이터 격리)
[ ] 이메일 webhook 연동
[ ] PWA vs Electron 패키징 방향 결정
[ ] 회원탈퇴 후 재로그인 버그 수정
[ ] food_preferences 옵션 확장 — 현재 ['한식','일식','중식','양식','채식','고단백'] 6개뿐, 더 세분화 필요 (예: 분식, 해산물, 매운맛, 담백한맛 등)
```
