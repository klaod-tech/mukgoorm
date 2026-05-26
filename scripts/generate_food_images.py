import sys
import re
import time
import base64
from pathlib import Path
from openai import OpenAI

sys.stdout.reconfigure(encoding='utf-8')

env_path = Path(__file__).parent.parent / 'web' / '.env.local'
env_content = env_path.read_text(encoding='utf-8')
api_key = re.search(r'VITE_OPENAI_API_KEY=(.+)', env_content).group(1).strip()

client = OpenAI(api_key=api_key)

FOODS = [
    # ── 한식 16개
    {'name': '삼겹살',    'id': 'samgyeopsal'},
    {'name': '김치찌개',  'id': 'kimchijjigae'},
    {'name': '비빔밥',    'id': 'bibimbap'},
    {'name': '순대국밥',  'id': 'sundaegukbap'},
    {'name': '족발',     'id': 'jokbal'},
    {'name': '갈비찜',    'id': 'galbijjim'},
    {'name': '된장찌개',  'id': 'doenjangjjigae'},
    {'name': '불고기',    'id': 'bulgogi'},
    {'name': '닭갈비',    'id': 'dakgalbi'},
    {'name': '삼계탕',    'id': 'samgyetang'},
    {'name': '해장국',    'id': 'haejanguk'},
    {'name': '냉면',     'id': 'naengmyeon'},
    {'name': '칼국수',    'id': 'kalguksu'},
    {'name': '보쌈',     'id': 'bossam'},
    {'name': '잡채',     'id': 'japchae'},
    {'name': '갈비탕',    'id': 'galbitang'},
    # ── 중식 8개
    {'name': '짜장면',    'id': 'jajangmyeon'},
    {'name': '짬뽕',     'id': 'jjambbong'},
    {'name': '탕수육',    'id': 'tangsuyuk'},
    {'name': '마라탕',    'id': 'maratang'},
    {'name': '마파두부',  'id': 'mapadubu'},
    {'name': '딤섬',     'id': 'dimsum'},
    {'name': '깐풍기',    'id': 'kkampunggi'},
    {'name': '양장피',    'id': 'yangjangpi'},
    # ── 양식 8개
    {'name': '피자',     'id': 'pizza'},
    {'name': '스테이크',  'id': 'steak'},
    {'name': '파스타',    'id': 'pasta'},
    {'name': '햄버거',    'id': 'hamburger'},
    {'name': '리조또',    'id': 'risotto'},
    {'name': '바비큐립',  'id': 'bbqrib'},
    {'name': '샐러드',    'id': 'salad'},
    {'name': '클럽샌드위치', 'id': 'clubsandwich'},
    # ── 분식 8개
    {'name': '치킨',     'id': 'chicken'},
    {'name': '떡볶이',    'id': 'tteokbokki'},
    {'name': '순대',     'id': 'sundae'},
    {'name': '어묵',     'id': 'eomuk'},
    {'name': '라면',     'id': 'ramyeon'},
    {'name': '김밥',     'id': 'gimbap'},
    {'name': '핫도그',    'id': 'hotdog'},
    {'name': '붕어빵',    'id': 'bungeoppang'},
    # ── 일식 8개
    {'name': '초밥',     'id': 'chobap'},
    {'name': '라멘',     'id': 'ramen'},
    {'name': '우동',     'id': 'udong'},
    {'name': '돈까스',    'id': 'donkkaseu'},
    {'name': '타코야키',  'id': 'takoyaki'},
    {'name': '텐동',     'id': 'tendon'},
    {'name': '야키토리',  'id': 'yakitori'},
    {'name': '가츠동',    'id': 'katsudon'},
    # ── 디저트 8개
    {'name': '아이스크림', 'id': 'icecream'},
    {'name': '케이크',    'id': 'cake'},
    {'name': '마카롱',    'id': 'macaron'},
    {'name': '와플',     'id': 'waffle'},
    {'name': '빙수',     'id': 'bingsu'},
    {'name': '타르트',    'id': 'tart'},
    {'name': '크레이프',  'id': 'crepe'},
    {'name': '도넛',     'id': 'donut'},
    # ── 기타 8개
    {'name': '쌀국수',    'id': 'pho'},
    {'name': '팟타이',    'id': 'padthai'},
    {'name': '인도카레',  'id': 'indiancurry'},
    {'name': '타코',     'id': 'taco'},
    {'name': '케밥',     'id': 'kebab'},
    {'name': '훠궈',     'id': 'huoguo'},
    {'name': '곱창',     'id': 'gobchang'},
    {'name': '감바스',    'id': 'gambas'},
]

output_dir = Path(__file__).parent.parent / 'web' / 'public' / 'foods'
output_dir.mkdir(parents=True, exist_ok=True)

def generate(food):
    output_path = output_dir / f"{food['id']}.png"
    if output_path.exists():
        print(f"⏭️  이미 존재: {food['name']}")
        return True

    prompt = f"간단하고 깔끔하게 음식 사진을 만들어줘 해당 사진은 2D 이미지 이고 음식은 {food['name']}을 만들어줘"
    print(f"🎨 생성 중: {food['name']}...", end=' ', flush=True)

    try:
        response = client.images.generate(
            model='gpt-image-2',
            prompt=prompt,
            n=1,
            size='1024x1024',
        )
        image_data = response.data[0].b64_json
        if image_data:
            output_path.write_bytes(base64.b64decode(image_data))
            print(f"✅ 저장: {food['id']}.png")
            return True
        else:
            # URL 형식으로 반환된 경우
            import urllib.request
            url = response.data[0].url
            urllib.request.urlretrieve(url, output_path)
            print(f"✅ 저장(url): {food['id']}.png")
            return True
    except Exception as e:
        print(f"❌ 실패: {e}")
        return False

def main():
    print(f"총 {len(FOODS)}개 음식 이미지 생성 시작\n")
    success, fail = 0, 0
    for i, food in enumerate(FOODS):
        ok = generate(food)
        if ok:
            success += 1
        else:
            fail += 1
        if i < len(FOODS) - 1:
            time.sleep(3)

    print(f"\n완료: 성공 {success}개 / 실패 {fail}개")
    print(f"저장 위치: {output_dir}")

if __name__ == '__main__':
    main()
