import time
import subprocess
import os
#from threading import Timer

def getvars(s,i):
	
	varlist        = []
	tokens		   = s.split("_")
	persona        = '_'.join([tokens[0].lower(),tokens[1],str(i)])	
	number 		   = str(i)
	containername  = s+number
	configfile     = tokens[1]+'_'+tokens[0]+'_browser_params_'+number+".json"
	mangerfile     = configfile.replace("_browser","_manager")
	directory_name = tokens[0]
	
	varlist.append(persona)
	varlist.append(containername)
	varlist.append(configfile)
	varlist.append(mangerfile)
	varlist.append(directory_name)
	return varlist

def process_docker(s,r):
	for i in r:
		
		varlist = getvars(s,i)
		cwd = os.getcwd()
		
# 		sudopass = 'cRVuMnmB4S'
# 		os.system('echo %s | sudo -S docker images' % (sudopass))

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

		time.sleep(60)

def collect_ads(varlist):
	
	cwd = os.getcwd()
	
	## Get HB Ads
	#cmd = ['docker', 'run','-v','{}/config/Phase1/{}/{}:/opt/OpenWPM/config/Phase1/{}/{}'.format(cwd,varlist[4],varlist[2],varlist[4],varlist[2]),'-v','{}/config/Phase1/{}/{}:/opt/OpenWPM/config/Phase1/{}/{}'.format(cwd,varlist[4],varlist[3],varlist[4],varlist[3]),'-v','{}/demo.py:/opt/OpenWPM/demo.py'.format(cwd),'-v','{}/openwpm/deploy_browsers/deploy_firefox.py:/opt/OpenWPM/openwpm/deploy_browsers/deploy_firefox.py'.format(cwd),'-v','{}/custom_command.py:/opt/OpenWPM/custom_command.py'.format(cwd),'-v','{}/data/easylist.txt:/opt/OpenWPM/data/easylist.txt'.format(cwd),'-v', '{}/data/Phase1/{}/:/opt/OpenWPM/datadir'.format(cwd,varlist[0]), '--name', varlist[1]+'_2', '--shm-size=2g', 'openwpm_v16', 'python', '/opt/OpenWPM/demo.py','config/Phase1/{}/{}'.format(varlist[4],varlist[2]),'2']
	cmd = ['python','demo.py','config/Phase1/{}/{}'.format(varlist[-1],varlist[2]),'2']
	process  = subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
	try:
		oput,err = process.communicate(timeout=15000)
	except Exception as e:
		print(str(e))

	time.sleep(60)
	## Get RTB Ads
	#cmd = ['docker', 'run','-v','{}/config/Phase1/{}/{}:/opt/OpenWPM/config/Phase1/{}/{}'.format(cwd,varlist[4],varlist[2],varlist[4],varlist[2]),'-v','{}/config/Phase1/{}/{}:/opt/OpenWPM/config/Phase1/{}/{}'.format(cwd,varlist[4],varlist[3],varlist[4],varlist[3]),'-v','{}/demo.py:/opt/OpenWPM/demo.py'.format(cwd),'-v','{}/openwpm/deploy_browsers/deploy_firefox.py:/opt/OpenWPM/openwpm/deploy_browsers/deploy_firefox.py'.format(cwd),'-v','{}/custom_command.py:/opt/OpenWPM/custom_command.py'.format(cwd),'-v','{}/data/easylist.txt:/opt/OpenWPM/data/easylist.txt'.format(cwd),'-v', '{}/data/Phase1/{}/:/opt/OpenWPM/datadir'.format(cwd,varlist[0]), '--name', varlist[1]+'_3', '--shm-size=2g', 'openwpm_v16', 'python', '/opt/OpenWPM/demo.py','config/Phase1/{}/{}'.format(varlist[4],varlist[2]),'3']
	cmd = ['python','demo.py','config/Phase1/{}/{}'.format(varlist[-1],varlist[2]),'3']
	process  = subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
	try:
		oput1,err1 = process.communicate(timeout=15000)
	except Exception as e:
		print(str(e))
	
	with open('{}/data/Phase1/{}/ad_collection2_done.txt'.format(cwd,varlist[0]),'w') as file:
		try:
			file.write(oput.decode("utf-8"))
		except:
			file.write(str(oput))
	with open('{}/data/Phase1/{}/ad_collection2_errors.txt'.format(cwd,varlist[0]),'w') as file:
		try:
			file.write(err.decode("utf-8"))
		except:
			file.write(str(err))
	with open('{}/data/Phase1/{}/ad_collection3_done.txt'.format(cwd,varlist[0]),'w') as file:
		try:
			file.write(oput1.decode("utf-8"))
		except:
			file.write(str(oput1))
	with open('{}/data/Phase1/{}/ad_collection3_errors.txt'.format(cwd,varlist[0]),'w') as file:
		try:
			file.write(err1.decode("utf-8"))
		except:
			file.write(str(err1))
	time.sleep(60)

def monitor_ad(s,r):

	for i in r:
		incomplete = True
		varlist = getvars(s,i)
		
		while(incomplete):
			for d in os.listdir(os.path.join("data/Phase1",varlist[0])):
				if(d == 'timestamp.txt'):
					file = open(os.path.join("data/Phase1",varlist[0],d),'r')
					ts   = float(file.read())
					file.close()
					cts  = time.time()
					while(cts - ts < 7200):
						time.sleep(60)
						cts = time.time()
					collect_ads(varlist)
					incomplete = False
			time.sleep(20)
            
	return
