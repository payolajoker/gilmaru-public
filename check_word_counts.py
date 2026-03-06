import re

def get_word_array_length(filename, array_name):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Find the array definition (e.g., const wordA = [ ... ];)
    pattern = rf"const {array_name} = \[\s*(.*?)\s*\];"
    match = re.search(pattern, content, re.DOTALL)
    
    if match:
        # Extract items
        items_str = match.group(1)
        # Split by comma and clean up quotes/whitespace
        items = [item.strip().strip('"').strip("'") for item in items_str.split(',') if item.strip()]
        return len(items)
    return 0

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    
    word_data_path = 'c:/Users/User/Desktop/새 폴더/프로젝트/gilmaru/word_data.js'
    
    arrays = ['wordA', 'wordB', 'wordC', 'wordD']
    
    print("=== word_data.js 단어 그룹별 개수 ===")
    for arr in arrays:
        count = get_word_array_length(word_data_path, arr)
        print(f"{arr}: {count}개")
    print("="*40)
