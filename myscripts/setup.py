## sys.argv[1] is path to persona folder
## sys.argv[2] is number of total personas you want to create (Has to be greater than number of personas in persona folder)
## sys.argv[3] is number of total sites in each persona


import os
import sys
import json
import random
sys.path.append(os.path.abspath('..'))
from openwpm.config import BrowserParams, ManagerParams

personas_path = '../data/personas'
NUM =       50
phase = 'Phase1'
NUM_BROWSERS = 1

IS= {}
with open("../data/intent.json","r") as file:
	IS = json.load(file)

IP= {}
with open("../data/ipmapping.json","r") as file:
	IP = json.load(file)

data = {}
ad_sites = {}
for file in os.listdir(personas_path):
	if ".ip" in file: continue    
	f = open(os.path.join(personas_path,file),'r').read()
	d = json.loads(f)
	print(file)
	data[file.replace('.json','')] = d[list(d.keys())[0]][:45]
	ad_sites[file.replace('.json','')] = d[list(d.keys())[1]]

entities = {}
entities['default'] = 1
for file in os.listdir('../data/ent_abp'):
	entities[file.replace('.txt','')] = 1

## data now has all categories and top 50 sites in each cat
## data now has all categories and top 50 sites in each cat
## data now has all categories and top 50 sites in each cat


manager_params = ManagerParams(num_browsers=NUM_BROWSERS)
browser_params = [BrowserParams(display_mode="headless") for _ in range(NUM_BROWSERS)]

browser_params = browser_params[0].to_dict()
manager_params = manager_params.to_dict()

## load deafault browser and manager params
## load deafault browser and manager params
## load deafault browser and manager params

Ad_Sites    = ['https://en.softonic.com/']
IntentSites = []

# if Intent == 'Intent':
# 	IntentSites = ['hotels.com','zales.com','jamesedition.com',  'andluxuryrealestate.com']


## Make N Personas for each category
## Make N Personas for each category
## Make N Personas for each category


for persona_name,value in data.items():

	#print(persona_name)
	temp = os.path.join('../config/{}'.format(phase),persona_name)
	if(not os.path.exists(temp)):
		os.makedirs(temp)


	sites = data[persona_name]

	i = 1
	while i <= NUM:
		for j in ['NoIntent','Intent']:

			Intent = j
			IntentSites = IS[persona_name]

			if j == 'NoIntent':
				 IntentSites = []
			
			ip = IP[persona_name+"_"+j]
			if(phase == 'Phase2'):
				for entity_name, value2 in entities.items():

					## Edit Config file for each persona
					## Edit Config file for each persona
					## Edit Config file for each persona

					#print('{}_{}_browser_params_{}.json'.format(persona_name,entity_name,str(i)))

					with open(os.path.join(temp,'{}_{}_browser_params_{}.json'.format(persona_name,entity_name,str(i))),'w') as json_file:
						t_browser_param 				      = browser_params
						t_browser_param["Persona_Path"]		  = "data/personas"
						t_browser_param["profile_archive_dir"]= "data/{}_{}_{}".format(persona_name.lower(),entity_name.lower(),str(i))
						t_browser_param["profile_tar"]		  = "data/{}_{}_{}".format(persona_name.lower(),entity_name.lower(),str(i))
						t_browser_param["Persona_Name"]		  = persona_name+".json"
						t_browser_param["Persona_Numb"]       = i
						t_browser_param["Browser_Config"]	  = "config/{}/{}_{}_browser_params_{}.json".format(persona_name,persona_name,entity_name,str(i))
						t_browser_param["Manager_Config"]	  = "config/{}/{}_{}_manager_params_{}.json".format(persona_name,persona_name,entity_name,str(i))
						t_browser_param["Browser_Config_Def"]	  = "default_browser_params.json"
						t_browser_param["Manager_Config_Def"]	  = "default_manager_params.json"
						t_browser_param["Number_of_Browsers"] = 1
						t_browser_param["Sites"]			  = sites
						t_browser_param["Storage_File"]		  = "storage_{}.js".format(entity_name)
						t_browser_param["ublock-origin"]	  = False
						t_browser_param["Ad_Sites"]	  		  = ad_sites[persona_name]
						t_browser_param["Intent"]	  		  = Intent
						t_browser_param["Intent_Sites"]		  = IntentSites
						t_browser_param["save_all_content"]	  = False
						t_browser_param["bot_mitigation"]	  = True
						json.dump(t_browser_param, json_file , indent=2)

					with open(os.path.join(temp,'{}_{}_manager_params_{}.json'.format(persona_name,entity_name,str(i))),'w') as json_file:
						json.dump(d_manager_param, json_file , indent=2)
			else:

				#print('{}_{}_browser_params_{}.json'.format(Intent,persona_name,str(i)))

				with open(os.path.join(temp,'{}_{}_browser_params_{}.json'.format(Intent,persona_name,str(i))),'w') as json_file:
					t_browser_param 				      = browser_params
					t_browser_param["Persona_Path"]		  = "data/personas"
					t_browser_param["profile_archive_dir"]= "data/{}/{}_{}_{}".format(phase,persona_name.lower().lower(),Intent,str(i))
					t_browser_param["profile_tar"]		  = "data/{}/{}_{}_{}".format(phase,persona_name.lower().lower(),Intent,str(i))
					t_browser_param["Persona_Name"]		  = persona_name+".json"
					t_browser_param["Persona_Numb"]       = i
					t_browser_param["Browser_Config"]	  = "config/{}/{}/{}_{}_browser_params_{}.json".format(phase,persona_name,Intent,persona_name,str(i))
					t_browser_param["Manager_Config"]	  = "config/{}/{}/{}_{}_manager_params_{}.json".format(phase,persona_name,Intent,persona_name,str(i))
					t_browser_param["Browser_Config_Def"]	  = "default_browser_params.json"
					t_browser_param["Manager_Config_Def"]	  = "default_manager_params.json"
					t_browser_param["Number_of_Browsers"] = 1
					t_browser_param["Sites"]			  = sites
					t_browser_param["Storage_File"]		  = "storage.js"
					t_browser_param["ublock_origin"]	  = False
					t_browser_param["Ad_Sites"]	 	 	  = ad_sites[persona_name]
					t_browser_param["Intent"]  		  = Intent
					t_browser_param["Intent_Sites"]		  = IntentSites
					t_browser_param["save_all_content"]	  = False
					t_browser_param["bot_mitigation"]	  = True
					t_browser_param["http_instrument"]	  = True
					t_browser_param["js_instrument"]	  = True
					t_browser_param["ip"]                     = ip
					t_browser_param["navigation_instrument"]  = True
					t_browser_param["callstack_instrument"]   = True                  

					json.dump(t_browser_param, json_file , indent=2)

				with open(os.path.join(temp,'{}_{}_manager_params_{}.json'.format(Intent,persona_name,str(i))),'w') as json_file:
					json.dump(manager_params, json_file , indent=2)


		i += 1

## Set up profile dir
## Set up profile dir
## Set up profile dir

profile_dirs = {}
for dirs in os.listdir('../config/{}'.format(phase)):
	for config_file in os.listdir('../config/{}/{}'.format(phase,dirs)):
		config_file = config_file.replace('_browser_params','')
		config_file = config_file.replace('_manager_params','')
		fpart = config_file.split("_")[0]
		mpart = '_'.join(config_file.split("_")[1:-1])
		lpart = config_file.split("_")[-1].replace('.json','')

		config_file = '_'.join([mpart.lower(),fpart,lpart])
		path = '../data/{}/{}'.format(phase,config_file)
		if(not os.path.exists(path)):
			os.makedirs(path)
