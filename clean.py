import os
import shutil
import stat

def remove_readonly(func, path, _):
    os.chmod(path, stat.S_IWRITE) 
    func(path)

for root, dirs, files in os.walk("."):
    for dir_name in dirs:
        if dir_name == "__pycache__":
            dir_path = os.path.join(root, dir_name)
            try:
                shutil.rmtree(dir_path, onerror=remove_readonly)
                print(f"Removed {dir_path}")
            except Exception as e:
                print(f"Failed to remove {dir_path}: {e}")