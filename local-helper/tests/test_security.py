import os
import pytest
from src.security import TokenManager, sanitize_filename, is_safe_path, generate_token

def test_sanitize_filename():
    assert sanitize_filename('my<new>file:name"is/here\\|?*') == 'my_new_file_name_is_here____'
    assert len(sanitize_filename('a' * 300)) == 200

def test_is_safe_path():
    base = os.path.abspath('C:\\test\\base')
    assert is_safe_path(base, os.path.join(base, 'sub', 'file.txt')) == True
    assert is_safe_path(base, os.path.join(base, '..', 'other', 'file.txt')) == False

def test_token_manager():
    # Use a custom temporary config dir for tests to avoid polluting appdata
    os.environ['APPDATA'] = os.path.join(os.getcwd(), 'temp_appdata')
    tm = TokenManager()
    
    # Test pairing code
    tm.set_pairing_code("123456")
    assert tm.get_pairing_code() == "123456"
    
    valid, result = tm.verify_pairing_code("000000")
    assert not valid
    
    valid, new_token = tm.verify_pairing_code("123456")
    assert valid
    assert tm.get_pairing_code() != "123456"  # Should be regenerated (new code)
    assert len(tm.get_pairing_code()) == 6  # Should be a valid 6-digit code
    
    # Test token
    assert tm.verify_token(new_token)
    assert not tm.verify_token("invalid_token")
    
    # Cleanup
    import shutil
    try:
        shutil.rmtree(os.environ['APPDATA'])
    except:
        pass
