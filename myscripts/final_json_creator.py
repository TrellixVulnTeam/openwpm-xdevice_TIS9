import os
import json
from PIL import Image
import imagehash
from tqdm import tqdm
from datetime import datetime

flask_pt = '../../flask_inference'
img_path = '../../flask_inference/static'
run_path = '../../flask_inference/runs/'
zip_path = '../../flask_inference/Zips/'
per_path = '../data/Phase1/'

def run_finder():

	w = 0
	for d in os.listdir(run_path):
		if('run' in d):
			print(d)
			t = d.split("_")[0][-1]
			t = int(t)
			if(t > w):
				w = t
	w += 1
	return "run"+str(w)+"_"+str(datetime.now()).split(" ")[0]

def calculate_hash(p):
	p = p
	p = str(imagehash.phash(Image.open(p)))
	return p

def image_agg(run):
	path  = per_path
	path2 = img_path
	for d in tqdm(os.listdir(path)):
		for dd in os.listdir(os.path.join(path,d)):
			if('.png' in dd):
				os.system("cp {} {}".format(os.path.join(path,d,dd),os.path.join(path2,run+'_'+dd)))

def final_creator(run):
	
	path = per_path
	
	final_json = []
	for d in tqdm(os.listdir(path)):

		for i in (os.listdir(os.path.join(path,d))):

			#sports_Intent_1_1.png
			#sports_Intent_1_1_url_1.png
			#sports_Intent_1_RTB_image_1.png

			if('.png' not in i):
				continue

			key  = '_'.join(i.split("_")[:4])
			key = key.split(".")[0]
			key_json = key+'.json'
			key_png  = os.path.join(path,d,i)

			if("RTB" in i):
				temp = {}
				try:
					temp['img_hash'] = calculate_hash(key_png)
				except Exception as e:
					continue

				temp['filename'] = run+"_"+i
				temp['img_url']  = os.path.join("static",temp['filename'])
				temp['RTB']		 = 1
				final_json.append(temp)
				continue

			for j in os.listdir(os.path.join(path,d)):
				
				temp = {}
				if(key_json == j):
					with open(os.path.join(path,d,key_json),'r') as file:
						temp = json.load(file)
					
					try:
						temp['img_hash'] = calculate_hash(os.path.join(path,d,i))
					except:
						continue

					temp['filename'] = run+"_"+i
					temp['img_url']  = os.path.join("static",temp['filename'])
					temp['RTB']		 = 0
					del temp['ad_html']
					del temp['urls']

					final_json.append(temp)
		
	with open(os.path.join(flask_pt,'{}_final.json'.format(run)),'w') as file:
		json.dump(final_json,file)

def backup(path,run):
	print("[BACKING EVERYTHING UP]-------------")
	os.system("zip -r -q {} {}".format(run,per_path))
	os.system("mv {}* {}".format(run,zip_path))


	return

def rename():
	path  = per_path
	for d in tqdm(os.listdir(path)):
		for dd in os.listdir(os.path.join(path,d)):
			if 'datadir' in dd:
				p1 = os.path.join(path,d,dd)
				newdd = dd.replace('datadir',d)
				p2 = os.path.join(path,d,newdd)
				os.system("mv {} {}".format(p1,p2))
                
def deletebigfiles():
	path  = per_path
	for d in tqdm(os.listdir(path)):
		for dd in os.listdir(os.path.join(path,d)):
			if 'profile' in dd or '.sqlite' in dd:
				os.system("rm {}".format(os.path.join(path,d,dd)))
                
run = run_finder()
rename()
deletebigfiles()
image_agg(run)
final_creator(run)
backup(per_path,run)
