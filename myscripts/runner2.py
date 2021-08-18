##Run font reverter once files are done
##Run font reverter once files are done
##Run font reverter once files are done


import os
import json
import multiprocessing
import time
import subprocess


def fontchanger(switch=1):

    if switch:
        runfile('./fontchanger.sh',"C.ROnaldo123")
    else:
        runfile('./fontreverter.sh',"C.ROnaldo123")


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
    rundemo(n,m,o)


def method2(n,m,o):
    
    ################ Desktop Version ##################
    rundemo(n,m,o)

    ################ Sleep 2 Hours  ###################
    print("Marinating Profile")
    time.sleep(60*60*5)


def runnerfunc1(i):

    method1('1','1',i)


def runnerfunc2(i):

    method1('2','1',i)


def runnerfunc3(i):

    method1('3','1',i)


#fontchanger(0)
time.sleep(10*60)
p1 = multiprocessing.Process(target=runnerfunc2, args=(11,))
p2 = multiprocessing.Process(target=runnerfunc2, args=(12,))
p3 = multiprocessing.Process(target=runnerfunc2, args=(13,))
p4 = multiprocessing.Process(target=runnerfunc2, args=(14,))
p5 = multiprocessing.Process(target=runnerfunc2, args=(15,))
p1.start()
p2.start()
p3.start()
p4.start()
p5.start()