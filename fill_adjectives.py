import re

def get_word_array_length(filename, array_name):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Find the array definition (e.g., const wordA = [ ... ];)
    # This is a simple regex for the specific format in word_data.js
    pattern = f"const {array_name} = \[\s*(.*?)\s*\];"
    match = re.search(pattern, content, re.DOTALL)
    
    if match:
        # Extract items
        items_str = match.group(1)
        # Split by comma and clean up quotes/whitespace
        items = [item.strip().strip('"').strip("'") for item in items_str.split(',') if item.strip()]
        return len(items)
    return 0

def get_topik2_adjectives(csv_filename):
    # Re-using the logic from analyze_adjectives but for TOPIK II positive words
    
    # Negative words to exclude (same as before)
    NEGATIVE_WORDS = {
        '괴롭다', '구질구질하다', '귀찮다', '나쁘다', '낯설다', '둔하다', '더럽다', '밉다', 
        '무섭다', '부끄럽다', '불행하다', '불편하다', '서투르다', '슬프다', '시끄럽다', '싫다', 
        '심심하다', '아깝다', '아프다', '안타깝다', '어둡다', '어렵다', '억울하다', '외롭다', 
        '우울하다', '위험하다', '지루하다', '피곤하다', '힘들다', '지저분하다', '초라하다', 
        '답답하다', '걱정하다', '나빠지다', '미안하다', '죄송하다', '실망하다', '짜증나다', 
        '속상하다', '창피하다', '망하다', '죽다', '다치다', '모르다', '고프다', '배고프다', 
        '무겁다', '못하다', '부족하다', '이상하다', '틀리다', '막히다', '복잡하다', '비싸다', 
        '시다', '쓰다', '맛없다', '맵다', '짜다', '차갑다', '춥다', '졸리다', '슬퍼하다', '재미없다',
        '아니다', '싸우다', '입원하다', '모르겠습니다', '미안합니다', '가난하다', '가렵다'
    }

    # Verify verbs list (condensed for this script)
    VERB_INDICATORS = ['go', 'come', 'eat'] # (Full list not needed if we filter by 'be ' + common sense)
    
    topik2_adj = []
    
    import csv
    with open(csv_filename, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        reader.fieldnames = [name.strip() for name in reader.fieldnames]
        
        for row in reader:
            level = (row.get('topik_level') or '').strip()
            if level != 'TOPIK II': continue
            
            korean = row['korean']
            english = row['english'].lower()
            
            if not korean.endswith('다'): continue
            if korean in NEGATIVE_WORDS: continue
            
            # Simple heuristic for "positive/neutral adjective"
            if english.startswith('be ') or english.startswith('to be ') or english.endswith('ble') or english.endswith('ful') or english.endswith('ous'):
                 topik2_adj.append(korean)
                 
    return topik2_adj

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    
    # 1. Check current length
    word_data_path = 'c:/Users/User/Desktop/새 폴더/프로젝트/gilmaru/word_data.js'
    len_A = get_word_array_length(word_data_path, 'wordA')
    print(f"Current wordA length: {len_A}")
    
    # 2. Load TOPIK I adjectives (already filtered)
    with open('topik1_adjectives.txt', 'r', encoding='utf-8') as f:
        t1_adj = [line.strip() for line in f if line.strip()]
        
    print(f"TOPIK I Adjectives count: {len(t1_adj)}")
    
    # 3. Get TOPIK II Adjectives candidates
    csv_path = 'c:/Users/User/Desktop/새 폴더/프로젝트/gilmaru/topik_vocabulary_combined.csv'
    t2_candidates = get_topik2_adjectives(csv_path)
    
    # Filter out any that might already be in T1 (unlikely but safe)
    t2_candidates = [w for w in t2_candidates if w not in t1_adj]
    
    # We need to fill up to at least len_A (presumably 100 or so)
    needed = len_A - len(t1_adj)
    
    print(f"Need {needed} more words to match current length.")
    
    # Select best TOPIK II words (manually curated list or first N)
    # Here we just take the first N for now, user can review.
    # Selecting "Safe" ones first if possible
    
    selected_t2 = t2_candidates[:needed + 20] # Get a bit more for buffer
    
    print(f"Suggested TOPIK II additions ({len(selected_t2)}): {', '.join(selected_t2)}")
    
    # Write combined to file
    with open('combined_adjectives.txt', 'w', encoding='utf-8') as f:
        full_list = t1_adj + selected_t2
        # Deduplicate
        full_list = sorted(list(set(full_list)))
        f.write('\n'.join(full_list))
