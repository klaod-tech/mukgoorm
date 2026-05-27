# N8N 캐릭터 이미지 생성 워크플로우

월드컵 완료 후 유저 취향 기반 AI 캐릭터 이미지 4장을 생성하고 Supabase Storage에 저장한다.

---

## 흐름

```
POST /webhook/generate-character
  ↓
character_generations 상태 조회
  ↓
IF status == 'done' → already_done 응답
  ↓ 아니면
이미지 4장 생성 (normal → happy → tired → eating)
각 생성 후 Supabase Storage 업로드 + DB 상태 저장
  ↓
완료 응답 (URLs 반환)
```

---

## 환경변수 설정

N8N Settings → Environment Variables에 아래 3개 추가:

| 키 | 값 |
|---|---|
| `SUPABASE_URL` | `https://{project_id}.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → service_role 키 |
| `OPENAI_API_KEY` | OpenAI API 키 |

---

## 노드 구성

### 노드 1: Webhook

| 설정 | 값 |
|---|---|
| HTTP Method | POST |
| Path | `generate-character` |
| Response Mode | Using 'Respond to Webhook' Node |

Request body:
```json
{
  "user_id": "유저 UUID",
  "top_category": "한식"
}
```

---

### 노드 2: Supabase - 상태 조회

| 설정 | 값 |
|---|---|
| Credential | Supabase account (기존) |
| Operation | Get All |
| Table | `character_generations` |
| Filter | `user_id` eq `{{ $json.body.user_id }}` |
| Limit | 1 |
| Always Output Data | ON |

---

### 노드 3: IF - 완료 여부 체크

| 설정 | 값 |
|---|---|
| Condition | `{{ $json.status }}` equals `done` |

- **True** → 노드 6 (already_done 응답)
- **False** → 노드 4 (이미지 생성)

---

### 노드 4: Code - 이미지 생성

Language: JavaScript

```javascript
const userId = $('Webhook').first().json.body.user_id;
const topCategory = $('Webhook').first().json.body.top_category;

const SUPABASE_URL = $env.SUPABASE_URL;
const SUPABASE_KEY = $env.SUPABASE_SERVICE_KEY;
const OPENAI_KEY = $env.OPENAI_API_KEY;

const CATEGORY_STYLES = {
  '한식':   { hair: 'warm chestnut brown',        palette: 'warm orange and earthy brown',  vibe: 'cozy and heartwarming' },
  '일식':   { hair: 'dark black with blue sheen',  palette: 'clean white and soft sky blue', vibe: 'calm and elegant' },
  '양식':   { hair: 'light golden blonde',          palette: 'soft cream and lavender',      vibe: 'refined and gentle' },
  '분식':   { hair: 'bright golden yellow',         palette: 'warm yellow and peach',        vibe: 'cheerful and lively' },
  '중식':   { hair: 'deep burgundy red',            palette: 'rich crimson and gold',        vibe: 'bold and vibrant' },
  '디저트': { hair: 'soft pastel pink',             palette: 'pastel pink and mint green',   vibe: 'sweet and dreamy' },
  '기타':   { hair: 'teal green',                   palette: 'emerald green and cyan',       vibe: 'adventurous and fresh' },
};

const EXPRESSIONS = {
  normal: 'calm neutral expression, gentle soft smile',
  happy:  'bright beaming smile, sparkling eyes, very cheerful',
  tired:  'heavy droopy eyes, slight pout, exhausted sleepy look',
  eating: 'happily eating, puffed cheeks, content and satisfied expression',
};

function buildPrompt(expression) {
  const s = CATEGORY_STYLES[topCategory] ?? CATEGORY_STYLES['기타'];
  return [
    'Cute chibi anime girl character, super deformed SD style,',
    'very large round head with small body, big expressive eyes,',
    `twin tail hairstyle, ${s.hair} hair color,`,
    `${s.palette} color scheme outfit,`,
    `${s.vibe} overall atmosphere,`,
    `${expression},`,
    'high quality illustration, soft cel shading, clean lineart,',
    'plain white background, centered full body view',
  ].join(' ');
}

const delay = ms => new Promise(r => setTimeout(r, ms));

async function saveStatus(patch) {
  await fetch(`${SUPABASE_URL}/rest/v1/character_generations`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ user_id: userId, ...patch, updated_at: new Date().toISOString() }),
  });
}

async function generateAndUpload(state, expression) {
  const genRes = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2', prompt: buildPrompt(expression), n: 1, size: '1024x1024' }),
  });
  const genJson = await genRes.json();
  const imageUrl = genJson.data[0].url;

  const imgBuffer = await (await fetch(imageUrl)).arrayBuffer();
  const path = `${userId}/${state}.png`;
  await fetch(`${SUPABASE_URL}/storage/v1/object/character-images/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: imgBuffer,
  });

  return `${SUPABASE_URL}/storage/v1/object/public/character-images/${path}`;
}

const normalUrl = await generateAndUpload('normal', EXPRESSIONS.normal);
await saveStatus({ status: 'partial_1', normal_url: normalUrl });
await delay(3000);

const happyUrl = await generateAndUpload('happy', EXPRESSIONS.happy);
await saveStatus({ status: 'partial_2', happy_url: happyUrl });
await delay(3000);

const tiredUrl = await generateAndUpload('tired', EXPRESSIONS.tired);
await saveStatus({ status: 'partial_3', tired_url: tiredUrl });
await delay(3000);

const eatingUrl = await generateAndUpload('eating', EXPRESSIONS.eating);
await saveStatus({ status: 'done', eating_url: eatingUrl });

return [{ json: { normalUrl, happyUrl, tiredUrl, eatingUrl } }];
```

---

### 노드 5: Respond to Webhook - 성공

노드 4 완료 후 연결.

| 설정 | 값 |
|---|---|
| Respond With | JSON |
| Response Body | `{{ $json }}` |

---

### 노드 6: Respond to Webhook - 이미 완료

IF True 브랜치에서 연결.

| 설정 | 값 |
|---|---|
| Respond With | JSON |
| Response Body | `{ "status": "already_done" }` |

---

## React 연동

워크플로우 완성 후 `characterGen.ts`의 `resumeOrStartGeneration`을 아래로 교체한다.

```typescript
export async function resumeOrStartGeneration(userId: string, topCategory: string): Promise<void> {
  const rec = await getCharacterGen(userId)
  if (rec?.status === 'done') return

  await fetch(`${N8N_WEBHOOK_BASE}/webhook/generate-character`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, top_category: topCategory }),
  })
}
```

`N8N_WEBHOOK_BASE`는 `.env`에 `VITE_N8N_URL`로 설정.

---

## 주의사항

- N8N 무료 플랜은 워크플로우 실행 시간 제한이 있으므로 Railway 등 유료 환경 권장
- 이미지 1장당 약 20~40초, 4장 + 딜레이 = 최대 3~4분 소요
- 브라우저가 닫혀도 N8N이 서버에서 계속 실행되므로 중단 없음
- 재시도는 React가 DB 상태 확인 후 `status != done`이면 webhook 재호출
