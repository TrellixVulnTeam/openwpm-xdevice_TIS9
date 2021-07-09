import os
import json
import multiprocessing
import time
import subprocess

################ Desktop Version ##################

os.chdir("..")

cmd = ['python','demo.py','config/browser_params.json','1','0']
process  = subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
try:
    oput,err = process.communicate(timeout=15000)
except Exception as e:
    print(str(e))

os.chdir("myscripts")
with open('../datadir/done1.txt','w') as file:
    try:
        file.write(oput.decode("utf-8"))
    except:
        file.write(str(oput))
with open('../datadir/errors1.txt','w') as file:
    try:
        file.write(err.decode("utf-8"))
    except:
        file.write(str(err))


################ Sleep 2 Hours  ###################
exit()
print("Marinating Profile")
time.sleep(60*60*2)

################ Mobile Version ###################

os.chdir("..")

cmd = ['python','demo.py','config/browser_params.json','2','0']
process  = subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
try:
    oput,err = process.communicate(timeout=15000)
except Exception as e:
    print(str(e))

os.chdir("myscripts")
with open('../datadir/done2.txt','w') as file:
    try:
        file.write(oput.decode("utf-8"))
    except:
        file.write(str(oput))
with open('../datadir/errors2.txt','w') as file:
    try:
        file.write(err.decode("utf-8"))
    except:
        file.write(str(err))