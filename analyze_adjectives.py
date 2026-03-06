import csv
import re

# List of common negative adjectives to exclude
NEGATIVE_WORDS = {
    '괴롭다', '구질구질하다', '귀찮다', '나쁘다', '낯설다', '둔하다', '더럽다', '밉다', 
    '무섭다', '부끄럽다', '불행하다', '불편하다', '서투르다', '슬프다', '시끄럽다', '싫다', 
    '심심하다', '아깝다', '아프다', '안타깝다', '어둡다', '어렵다', '억울하다', '외롭다', 
    '우울하다', '위험하다', '지루하다', '피곤하다', '힘들다', '지저분하다', '초라하다', 
    '답답하다', '걱정하다', '나빠지다', '미안하다', '죄송하다', '실망하다', '짜증나다', 
    '속상하다', '창피하다', '망하다', '죽다', '다치다', '모르다', '고프다', '배고프다', 
    '무겁다', '못하다', '부족하다', '이상하다', '틀리다', '막히다', '복잡하다', '비싸다', 
    '시다', '쓰다', '맛없다', '맵다', '짜다', '차갑다', '춥다', '졸리다', '슬퍼하다', '재미없다',
    '아니다', '싸우다', '입원하다', '모르겠습니다', '미안합니다'
}

# Explicit list of words to exclude (Verbs, Nouns, Phrases, etc.)
EXCLUDE_KOREAN_VERBS = {
    '가지다', '갖다', '걸다', '결정하다', '계산하다', '계시다', '고르다', '관광하다', 
    '굽다', '그리다', '기르다', '기뻐하다', '기억하다', '긴장되다', '깎다', '꾸다', 
    '끓이다', '나누다', '나타나다', '넘다', '노력하다', '놀라다', '누르다', '느끼다', 
    '다녀오다', '다니다', '닦다', '닫다', '닫히다', '달리다', '담그다', '대답하다', 
    '도착하다', '돌다', '돕다', '드리다', '드시다', '듣다', '들다', '들어가다', 
    '들어오다', '떠나다', '떠들다', '마시다', '만나다', '만들다', '만지다', '말하다', 
    '맛보다', '맡다', '매다', '먹다', '멈추다', '모르다', '모으다', '모이다', '묵다', 
    '묻다', '물어보다', '받다', '배우다', '버리다', '벗다', '보내다', '보다', '보이다', 
    '볶다', '뵙다', '빌리다', '빠지다', '빨다', '빼다', '사다', '사랑하다', '사용하다', 
    '살다', '생각하다', '서다', '선택하다', '설명하다', '소개하다', '쉬다', '시작하다', 
    '시키다', '신다', '싫어하다', '씻다', '앉다', '알다', '알아보다', '열다', '오다', 
    '오르다', '올라가다', '울다', '움직이다', '웃다', '이기다', '이사하다', '이용하다', 
    '이해하다', '일어나다', '읽다', '잃다', '잃어버리다', '입다', '자다', '잡다', 
    '전하다', '전화하다', '정하다', '조심하다', '졸다', '좋아하다', '주다', '주문하다', 
    '준비하다', '지나다', '지내다', '지키다', '질문하다', '찾다', '청소하다', '초대하다', 
    '축하하다', '출발하다', '춤추다', '켜다', '타다', '태어나다', '틀다', '팔다', 
    '펴다', '피다', '피우다', '하다', '헤어지다', '화나다', '확인하다', '회의하다', 
    '흐리다', '흔들다',
    # Additional removals
    '감동하다', '감사하다', '감사합니다', '고맙다', '고맙습니다', '고마웠습니다', 
    '괜찮습니다', '그렇다', '그렇습니다', '늘다', '다', '닮다', '덮다', '따라가다', 
    '따르다', '마르다', '메다', '밀리다', '바뀌다', '바라다', '불다', '붓다', 
    '붙다', '붙이다', '사이다', '사인하다', '생각되다', '생기다', '세우다', '세일하다', 
    '수술하다', '시작되다', '실례하다', '쌓이다', '썰다', '쓰이다', '씹다', '안내하다', 
    '안다', '알리다', '알았습니다', '연습하다', '열리다', '오래간만입니다', '원하다', 
    '위하다', '인사하다', '인터뷰하다', '잊다', '잊어버리다', '자르다', '정리하다', 
    '조사하다', '졸업하다', '주차하다', '줄다', '즐거워하다', '즐기다', '지다', 
    '짓다', '차다', '차리다', '취소하다', '치료하다', '캐나다', '통하다', '풀다', 
    '화장하다', '환영하다', '반갑다', '반갑습니다', '어서오세요', '실례합니다', '죄송합니다', 
    '축하합니다', '되다', '있다', '없다', '이렇다', '어떻다', '저렇다'
}

# Heuristic to identify action verbs (to exclude them from adjectives)
VERB_INDICATORS = [
    'go', 'come', 'eat', 'drink', 'buy', 'sell', 'teach', 'learn', 
    'run', 'walk', 'meet', 'read', 'write', 'listen', 'speak', 'talk',
    'do', 'make', 'use', 'wear', 'give', 'receive', 'send', 'pay',
    'work', 'study', 'drive', 'cook', 'clean', 'wash', 'take', 'bring',
    'get', 'put', 'hold', 'start', 'finish', 'wait', 'borrow', 'lend',
    'change', 'transfer', 'cross', 'ask', 'answer', 'sleep', 'wake',
    'stand', 'sit', 'laugh', 'cry', 'sing', 'dance', 'exercise', 'play',
    'rest', 'help', 'open', 'close', 'turn', 'stop', 'smoke', 'marry',
    'enter', 'leave', 'depart', 'arrive', 'fall', 'drop', 'break', 'fix',
    'catch', 'ride', 'worry'
]

def is_likely_adjective(korean_word, english_def):
    if not korean_word.endswith('다'):
        return False
        
    if korean_word in NEGATIVE_WORDS:
        return False
        
    if korean_word in EXCLUDE_KOREAN_VERBS:
        return False
        
    english_def = english_def.lower().strip()
    
    # "be ..." is a strong indicator of adjective in this dataset
    if english_def.startswith('be '):
        return True
    
    # "to be ..."
    if english_def.startswith('to be '):
        return True

    # If simple definition matches a known verb exactly or starts with it
    meanings = [m.strip() for m in english_def.split(',')]
    for meaning in meanings:
        first_word = meaning.split(' ')[0]
        if first_word in VERB_INDICATORS:
            return False
            
    # Suffix checks common for adjectives
    if english_def.endswith('ble') or english_def.endswith('ous') or english_def.endswith('ful'):
        return True
    
    # Allow simple adjectives that might not match "be ..." but are not in exclusion list
    # e.g. "pretty", "hot", "cold"
    # Since we excluded specific verbs, remaining short words are likely adjectives or nouns (but we check endswith '다')
    return True

def analyze_csv(filename):
    topik1_adj = []
    topik2_adj = []
    
    # Debug unique levels
    seen_levels = set()

    try:
        with open(filename, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            reader.fieldnames = [name.strip() for name in reader.fieldnames]
            
            for row in reader:
                level = (row.get('topik_level') or row.get('\ufefftopik_level') or '').strip()
                seen_levels.add(level)
                
                korean = row['korean']
                english = row['english']
                
                # Debug specific word
                if korean == '훌륭하다':
                    print(f"DEBUG: Found 훌륭하다. Level: '{level}', English: '{english}', IsAdj: {is_likely_adjective(korean, english)}")

                if is_likely_adjective(korean, english):
                    # Use exact match or check specific string
                    if level == 'TOPIK I':
                        topik1_adj.append(korean)
                    elif level == 'TOPIK II':
                        topik2_adj.append(korean)
    
    except Exception as e:
        print(f"Error: {e}")
        
    return topik1_adj, topik2_adj

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8')

    file_path = 'c:/Users/User/Desktop/새 폴더/프로젝트/gilmaru/topik_vocabulary_combined.csv'
    t1, t2 = analyze_csv(file_path)
    
    # Write only TOPIK I adjectives to a clean file
    with open('topik1_adjectives.txt', 'w', encoding='utf-8') as f:
        # Deduplicate and sort
        unique_t1 = sorted(list(set(t1)))
        f.write('\n'.join(unique_t1))
        
    print(f"Successfully extracted {len(set(t1))} TOPIK I adjectives to 'topik1_adjectives.txt'")
    print(f"Sample: {', '.join(sorted(list(set(t1)))[:20])}")
