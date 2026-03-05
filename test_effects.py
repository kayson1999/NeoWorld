import asyncio
from src.ai.llm_client import LLMClient

async def test():
    llm = LLMClient()
    state = {'name':'测试','health':100,'hunger':100,'money':50,'reputation':10,'day':1}
    
    # 测试铁柱 3 次
    for i in range(3):
        r = await llm.chat_with_npc('foreman', '铁柱哥，我花十元给你买个吃的', state)
        pe = r['effects'].get('player_effects', {})
        print(f'foreman #{i+1}: player_effects={pe}')
        llm.clear_npc_history('foreman')
    
    print('---')
    
    # 测试老乞丐 2 次
    for i in range(2):
        r = await llm.chat_with_npc('beggar', '老人家，我花十元给你买个吃的', state)
        pe = r['effects'].get('player_effects', {})
        print(f'beggar #{i+1}: player_effects={pe}')
        llm.clear_npc_history('beggar')
    
    print('---')
    
    # 测试钱不够的情况
    state2 = {**state, 'money': 5}
    r = await llm.chat_with_npc('foreman', '铁柱哥，我花十元给你买个吃的', state2)
    pe = r['effects'].get('player_effects', {})
    print(f'foreman (money=5): player_effects={pe}, reply={r["reply"][:50]}')

asyncio.run(test())
