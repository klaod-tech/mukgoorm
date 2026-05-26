# 프론트엔드 다음 개선 사항

## 🔴 버그 수정

### 1. 회원탈퇴 시 Auth 유저 미삭제
**현상**: 회원탈퇴 후 동일 계정으로 재로그인 가능. `users` 테이블 row는 삭제되지만 Supabase Auth 유저가 남아 있어 같은 이메일/비밀번호로 재가입 없이 로그인됨.

**원인**: 클라이언트에서 `auth.admin.deleteUser()`를 호출하려면 service role key가 필요한데, 프론트엔드에 노출 불가.

**해결 방법**: Supabase Edge Function 생성
```
supabase/functions/delete-user/index.ts
  → auth.admin.deleteUser(user_id) 호출
  → service role key는 Edge Function 환경변수로 관리
```
`handleDeleteAccount` (Settings.tsx)에서 Edge Function을 호출하도록 수정.

---

### ✅ 2. evoState 초기값 오류 — 수정 완료
**파일**: [web/src/pages/Home.tsx](../web/src/pages/Home.tsx)

**현상**: 앱 로드 시 캐릭터 진화 상태 체크를 건너뜀. 진화 여부를 확인하기 전에 `'evolved'`로 시작해 조건 분기가 틀어짐.

**수정**: `EvoState`에 `'checking'` 추가, 초기값을 `'checking'`으로 변경. 헤더 텍스트에 `'checking'` 케이스("불러오는 중...") 추가.

---

### ✅ 3. Worldcup.tsx 셔플 편향 — 수정 완료
**파일**: [web/src/pages/Worldcup.tsx](../web/src/pages/Worldcup.tsx)

**현상**: 음식 월드컵 대진 순서가 무작위처럼 보이지만 실제로는 편향 있음.

**수정**: `sort(() => Math.random() - 0.5)` → Fisher-Yates 알고리즘으로 교체.

---

### ✅ 4. email_app_pw 보안 취약점 — 수정 완료
**파일**: [web/src/hooks/useUser.ts](../web/src/hooks/useUser.ts)

**현상**: 이메일 앱 비밀번호가 sessionStorage에 평문으로 저장됨. XSS 공격 시 탈취 가능.

**수정**: `setCachedProfile`에서 `email_app_pw`를 destructuring으로 제외하고 저장.

---

## 🟡 나중에 구현

### 1. 로그인 세션 유지 (자동 로그인)
**현재**: `persistSession: false` — 탭 닫으면 로그아웃됨 (의도된 동작).
**향후**: 온보딩 흐름 안정화 후 `persistSession: true`로 변경하여 재방문 시 자동 로그인 구현.
단, 활성화 전 온보딩 리다이렉트 로직 충분히 검증 필요.

---

### ✅ 2. BOT_TIMEOUT 데드코드 정리 — 수정 완료
**파일**: [web/src/lib/n8n.ts](../web/src/lib/n8n.ts)

**수정**: `BOT_TIMEOUT` 빈 객체 제거, 호출부에서 `DEFAULT_TIMEOUT` 직접 사용.
