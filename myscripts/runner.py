import os
import json
import multiprocessing
import time
import subprocess

def runfile(filename,passw):

    os.system('echo {} | sudo -S {}'.format(passw,filename))    
    return


def rundemo(n,m):
    
    os.chdir("..")
    cmd = ['python','demo.py','config/browser_params.json',n,m]
    process  = subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    try:
        oput,err = process.communicate(timeout=75000)
    except Exception as e:
        print(str(e))

    os.chdir("myscripts")
    with open('../datadir/done{}.txt'.format(n),'w') as file:
        try:
            file.write(oput.decode("utf-8"))
        except:
            file.write(str(oput))
    with open('../datadir/errors{}.txt'.format(n),'w') as file:
        try:
            file.write(err.decode("utf-8"))
        except:
            file.write(str(err))


# ################ Desktop Version ##################
# rundemo('2','0')

# ################ Sleep 2 Hours  ###################
# print("Marinating Profile")
# time.sleep(60*60*4)

################ Mobile Version ###################
runfile('./fontchanger.sh',"C.ROnaldo123")
rundemo('3','0')
runfile('./fontreverter.sh',"C.ROnaldo123")
