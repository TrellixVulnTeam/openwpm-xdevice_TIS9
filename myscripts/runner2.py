import os
import json
import multiprocessing
import time
import subprocess

def runfile(filename,passw):

    os.system('echo {} | sudo -S {}'.format(passw,filename))    
    return


def rundemo(n,m,o):
    
    os.chdir("..")
    cmd = ['python','demo.py','config/browser_params.json',n,m,str(o)]
    process  = subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    try:
        oput,err = process.communicate(timeout=15000)
    except Exception as e:
        print(str(e))

    os.chdir("myscripts")
    with open('../datadir{}/done{}.txt'.format(str(o),n),'w') as file:
        try:
            file.write(oput.decode("utf-8"))
        except:
            file.write(str(oput))
    with open('../datadir{}/errors{}.txt'.format(str(o),n),'w') as file:
        try:
            file.write(err.decode("utf-8"))
        except:
            file.write(str(err))


def method1(n,m,o):

    #############    Mobile Version ###################
    runfile('./fontchanger.sh',"C.ROnaldo123")
    rundemo(n,m,o)

    ################ Sleep 5 minutes  ###################
    runfile('./fontreverter.sh',"C.ROnaldo123")
    print("Sleeping for 5 mintues")
    time.sleep(60*5)


def method2(n,m,o):
    
    ################ Desktop Version ##################
    rundemo(n,m,o)

    ################ Sleep 2 Hours  ###################
    print("Marinating Profile")
    time.sleep(60*60*5)


for i in range(1,6):
    method1('1','1',i)
    method2('2','1',i)
    method1('3','1',i)