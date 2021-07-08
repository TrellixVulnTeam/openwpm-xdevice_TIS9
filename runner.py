import os
import json
import multiprocessing
import time
from multi import process_docker
from multi import monitor_ad
import subprocess


cmd = ['python','demo.py','config/Phase1/{}/{}'.format(varlist[-1],varlist[2]),'1']
process  = subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
try:
    oput,err = process.communicate(timeout=15000)
except Exception as e:
    print(str(e))


with open('{}/data/Phase1/{}/done.txt'.format(cwd,varlist[0]),'w') as file:
    try:
        file.write(oput.decode("utf-8"))
    except:
        file.write(str(oput))
with open('{}/data/Phase1/{}/errors.txt'.format(cwd,varlist[0]),'w') as file:
    try:
        file.write(err.decode("utf-8"))
    except:
        file.write(str(err))
with open('{}/data/Phase1/{}/timestamp.txt'.format(cwd,varlist[0]),'w') as file:
    file.write(str(time.time()))