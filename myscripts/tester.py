import time
import subprocess
import os

cmd = ['docker', 'run',
'-v','/home/data/maaz/Ads/H1/Gitlab/openwpm16_RTBstyle/OpenWPM/config/Phase1/Sports/NoIntent_Sports_browser_params_1.json:/opt/OpenWPM/config/Phase1/Sports/NoIntent_Sports_browser_params_1.json',
'-v','/home/data/maaz/Ads/H1/Gitlab/openwpm16_RTBstyle/OpenWPM/config/Phase1/Sports/NoIntent_Sports_manager_params_1.json:/opt/OpenWPM/config/Phase1/Sports/NoIntent_Sports_manager_params_1.json',
'-v','/home/data/maaz/Ads/H1/Gitlab/openwpm16_RTBstyle/OpenWPM/demo.py:/opt/OpenWPM/demo.py',
'-v','/home/data/maaz/Ads/H1/Gitlab/openwpm16_RTBstyle/OpenWPM/openwpm/deploy_browsers/deploy_firefox.py:/opt/OpenWPM/openwpm/deploy_browsers/deploy_firefox.py',
'-v','/home/data/maaz/Ads/H1/Gitlab/openwpm16_RTBstyle/OpenWPM/custom_command.py:/opt/OpenWPM/custom_command.py',
'-v', '/home/data/maaz/Ads/H1/Gitlab/openwpm16_RTBstyle/OpenWPM/data/Phase1/sports_NoIntent_1:/opt/OpenWPM/datadir','-v', '/home/data/maaz/Ads/H1/Gitlab/openwpm16_RTBstyle/OpenWPM/data/easylist.txt:/opt/OpenWPM/data/easylist.txt','--shm-size=2g', 'openwpm_v16', 'python', '/opt/OpenWPM/demo.py','config/Phase1/Sports/NoIntent_Sports_browser_params_1.json','1']

process  = subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
oput,err = process.communicate(timeout=5400)

with open('done.txt','w') as file:
	file.write(oput.decode("utf-8"))
with open('errors.txt','w') as file:
	file.write(err.decode("utf-8"))
