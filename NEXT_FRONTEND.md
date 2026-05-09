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

## 🟡 나중에 구현

### 2. 로그인 세션 유지 (자동 로그인)
**현재**: `persistSession: false` — 탭 닫으면 로그아웃됨 (의도된 동작).
**향후**: 온보딩 흐름 안정화 후 `persistSession: true`로 변경하여 재방문 시 자동 로그인 구현.
단, 활성화 전 온보딩 리다이렉트 로직 충분히 검증 필요.