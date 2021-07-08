import os
import time
import subprocess
import os
from datetime import datetime


now = datetime.now()
print("now =", now)

# dd/mm/YY H:M:S
dt_string = now.strftime("%d/%m/%Y %H:%M:%S")
print("date and time =", dt_string)


cmd = ['python','demo.py','config/Phase1/Sports/NoIntent_Sports_browser_params_1.json','1']
process  = subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
oput,err = process.communicate(timeout=20000)

print(str(oput))
#os.system("python demo.py config/Phase1/Sports/NoIntent_Sports_browser_params_1.json 1")

with open('done.txt','w') as file:
    file.write(oput.decode("utf-8"))


now = datetime.now()
print("now =", now)

# dd/mm/YY H:M:S
dt_string = now.strftime("%d/%m/%Y %H:%M:%S")
print("date and time =", dt_string)
