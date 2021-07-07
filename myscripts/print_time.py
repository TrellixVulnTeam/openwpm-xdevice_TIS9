from datetime import datetime
import time
import subprocess
import os

# datetime object containing current date and time
now = datetime.now()
 
print("now =", now)

# dd/mm/YY H:M:S
dt_string = now.strftime("%d/%m/%Y %H:%M:%S")
print("date and time =", dt_string)

while(1):
    cmd = ['python','tester.py']
    process  = subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    oput,err = process.communicate(timeout=5400)
    print(oput)
    time.sleep(5)
    break
