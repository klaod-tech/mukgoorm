# 다음 작업 목록

> 최종 업데이트: 2026-05-19  
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
| B/C 경로 응답에 menus 포함 | ✅ |

### React
| 항목 | 상태 |
|---|---|
| 피드백 버튼 UI (선택 시 glow 효과, 중복 클릭 방지) | ✅ |
| `sendFeedback` → POST body에서 `reaction` 키로 변환 | ✅ |
| `Restaurant` interface에 `menus?: MenuItem[]` 추가 | ✅ |
| `fetchRestaurantMenu` 제거 → `restaurant.menus` 직접 사용 | ✅ |

### Supabase
| 항목 | 상태 |
|---|---|
| `food_feedback` 테이블에 `restaurant_id` 컬럼 추가 | ✅ |
| `user_preference_logits` 온보딩 시 0으로 초기화 | ✅ |

---

## 🚨 긴급 / 우선순위 높음

### [긴급 1] 알레르기 기능 폐기 + 음식명 키워드 추출로 교체

**폐기:** `allergens`, `allergies` 관련 로직 전체 제거

**신규:** 메뉴 이름에서 핵심 음식 키워드 추출
- `온정돈까스` → `돈까스`
- `로티세리 치킨 타코 샐러드` → `치킨, 타코, 샐러드`

**영향 범위:**
- n8n: C경로 `Food` 프롬프트에서 알레르기 조건 제거, 태그 기반 매칭에 추출 키워드 활용
- n8n: `식당 메뉴 연동1` 또는 응답 포맷에서 `allergens` 필드 제거
- React: `Restaurant` interface에서 `allergens` 제거
- Supabase: `menu_items.allergens` 컬럼 사용 중단 (삭제는 선택)

---

## 🔲 진행 중 — Step 3-3

### [우선순위 2] n8n: `/food/select` webhook 추가 (로짓 +0.1)

`먹구름_봇v2` 캔버스에 추가할 흐름:

```
메뉴 선택 입력 (Webhook - path: food/select)
    → 방문 기록 저장 (Supabase Create - restaurant_log)
    → 메뉴선택 현재 로짓 (Supabase Get Many - user_preference_logits)
    → 메뉴선택 로짓 계산 (Code - +0.1)
    → 로짓 업데이트 (Supabase Update - user_preference_logits)
    → 선택 완료 출력 (Respond to Webhook)
```

상세 설정 → [docs/guide/n8n_03_메뉴선택_로짓.md](docs/guide/n8n_03_메뉴선택_로짓.md)

---

## 📋 다음 작업 순서

### [우선순위 3] Step 4 — 월드컵 webhook 추가 (먹구름_봇v2)

```
월드컵 입력 (Webhook - path: worldcup)
    → 현재 로짓 (Supabase Get Many)
    → 월드컵 계산 (Code - 델타 누적 + Softmax)
    → 세션 저장 (HTTP Request - worldcup_sessions)
    → 로짓 저장 (HTTP Request - user_preference_logits upsert)
    → 최종 응답 (Code)
    → 응답 (Respond to Webhook)
```

상세 설정 → [docs/guide/n8n_04_worldcup.md](docs/guide/n8n_04_worldcup.md)

---

### [우선순위 4] Step 5 — 테스트 및 검증

```
[ ] 음식 추천 → 식당 카드 클릭 → 메뉴 패널 표시 확인
[ ] 메뉴 선택 → user_preference_logits logit +0.1 확인
[ ] 피드백 👍 → logit +0.2 확인
[ ] 피드백 👎 → logit -0.2 확인
[ ] 월드컵 완료 → worldcup_sessions 저장 + logit 업데이트 확인
[ ] 음식 추천 → Softmax 정렬 반영 확인 (피드백 후 재추천 시 변화)
```

---

### 미결 사항 (장기)

```
[ ] n8n Railway 배포 (팀 공유 인스턴스)
[ ] Supabase RLS 정책 설계 (유저별 데이터 격리)
[ ] 이메일 webhook 연동
[ ] PWA vs Electron 패키징 방향 결정
[ ] 회원탈퇴 후 재로그인 버그 수정
```
