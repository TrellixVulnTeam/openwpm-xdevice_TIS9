""" This file aims to demonstrate how to write custom commands in OpenWPM

Steps to have a custom command run as part of a CommandSequence

1. Create a class that derives from BaseCommand
2. Implement the execute method
3. Append it to the CommandSequence
4. Execute the CommandSequence

"""
import logging

from selenium.webdriver import Firefox
from selenium.webdriver.common.by import By

from openwpm.commands.types import BaseCommand
from openwpm.config import BrowserParams, ManagerParams
from openwpm.socket_interface import ClientSocket

import os
import re
import json
import time
import urllib.request


import sys
import csv
import sqlite3
import tldextract
import pandas as pd
from adblockparser import AdblockRules

st = time.time()
raw_rules = []
with open("data/easylist.txt","r") as file:
	lines = file.readlines()
	for line in lines:
		raw_rules.append(line.strip("\n"))
#print(raw_rules)
rules = AdblockRules(raw_rules)

class ScrollDown(BaseCommand):
    
    def __init__(self) -> None:
        self.logger = logging.getLogger("scrollDown")

    # While this is not strictly necessary, we use the repr of a command for logging
    # So not having a proper repr will make your logs a lot less useful
    def __repr__(self) -> str:
        return "ScrollDown"

    # Have a look at openwpm.commands.types.BaseCommand.execute to see
    # an explanation of each parameter
    def execute(
        self,
        webdriver: Firefox,
        browser_params: BrowserParams,
        manager_params: ManagerParams,
        extension_socket: ClientSocket,
    ) -> None:
        scroll(webdriver,"down")

class ScrollUp(BaseCommand):
    
    def __init__(self) -> None:
        self.logger = logging.getLogger("scrollUp")

    # While this is not strictly necessary, we use the repr of a command for logging
    # So not having a proper repr will make your logs a lot less useful
    def __repr__(self) -> str:
        return "ScrollUp"

    # Have a look at openwpm.commands.types.BaseCommand.execute to see
    # an explanation of each parameter
    def execute(
        self,
        webdriver: Firefox,
        browser_params: BrowserParams,
        manager_params: ManagerParams,
        extension_socket: ClientSocket,
    ) -> None:
        scroll(webdriver,"up")
        
def scroll(driver,direction):
        
    SCROLL_PAUSE_TIME = 3
    SCROLL_COUNT      = 0
    

    while True:
        
        # Scroll down to bottom
        
        if direction == "down":
            driver.execute_script("scrollBy(0,2000);")
        else:
            driver.execute_script("scrollBy(0,-2000);")
        
        # Wait to load page
        time.sleep(SCROLL_PAUSE_TIME)

        SCROLL_COUNT += 1
        if SCROLL_COUNT == 20:
            break
    
    return
        
        
class LinkCountingCommand(BaseCommand):
    """This command logs how many links it found on any given page"""

    def __init__(self) -> None:
        self.logger = logging.getLogger("openwpm")

    # While this is not strictly necessary, we use the repr of a command for logging
    # So not having a proper repr will make your logs a lot less useful
    def __repr__(self) -> str:
        return "LinkCountingCommand"

    # Have a look at openwpm.commands.types.BaseCommand.execute to see
    # an explanation of each parameter
    def execute(
        self,
        webdriver: Firefox,
        browser_params: BrowserParams,
        manager_params: ManagerParams,
        extension_socket: ClientSocket,
    ) -> None:
        current_url = webdriver.current_url
        link_count = len(webdriver.find_elements(By.TAG_NAME, "a"))
        self.logger.info("There are %d links on %s", link_count, current_url)

################################################### HB AD SECTION ###################################################        
################################################### HB AD SECTION ###################################################        
################################################### HB AD SECTION ###################################################        

class GetHBJson(BaseCommand):
    """This command gets HB ads from the page currently visiting"""

    def __init__(self,n) -> None:
        self.logger = logging.getLogger("openwpm")
        self.n      = n

    # While this is not strictly necessary, we use the repr of a command for logging
    # So not having a proper repr will make your logs a lot less useful
    def __repr__(self) -> str:
        return "GettingHeaderBiddingAd"

    # Have a look at openwpm.commands.types.BaseCommand.execute to see
    # an explanation of each parameter
    def execute(
        self,
        webdriver: Firefox,
        browser_params: BrowserParams,
        manager_params: ManagerParams,
        extension_socket: ClientSocket,
    ) -> None:

        # Sleep so network can gather ads
        time.sleep(30)
        getadsfunc(browser_params.custom_params["path"],self.n,webdriver)


def getadsfunc(path,mode,driver):
    
    js = "var output = [];"\
      "function getCPM()"\
      "{"\
      " var responses = pbjs.getBidResponses();"\
      " Object.keys(responses).forEach(function(adUnitCode){"\
      " var response = responses[adUnitCode];"\
      "     response.bids.forEach(function(bid)"\
      "     {"\
      "         output.push({"\
      "         ad: bid"\
      "         "\
      "         "\
      "         "\
      "         "\
      "         });"\
      "     });"\
      " });"\
      "}"\
      "getCPM();"\
      "return output;"
    try:
        status = driver.execute_script(js)
        stl = [str(i) for i in status]
        st = ' '.join(stl)
    except:
        st = ""

    path = os.path.join(path,"Header_Bidding"+str(mode))
    if(not os.path.exists(path)):
        f = open(path,'w')
        f.close()
    f = open(path,'w')
    f.write('\r\n')
    f.write(st)
    f.close()
    return

##################################### HB AD FROM JSON SECTION ####################################################
##################################### HB AD FROM JSON SECTION ####################################################
##################################### HB AD FROM JSON SECTION ####################################################

class GetHBAds(BaseCommand):
    """This command gets HB ads from the saved json"""

    def __init__(self,n) -> None:
        self.logger = logging.getLogger("openwpm")
        self.n      = n

    # While this is not strictly necessary, we use the repr of a command for logging
    # So not having a proper repr will make your logs a lot less useful
    def __repr__(self) -> str:
        return "GettingHBiddingImages"

    # Have a look at openwpm.commands.types.BaseCommand.execute to see
    # an explanation of each parameter
    def execute(
        self,
        webdriver: Firefox,
        browser_params: BrowserParams,
        manager_params: ManagerParams,
        extension_socket: ClientSocket,
    ) -> None:
        
        extractads(browser_params.custom_params["path"],self.n)
        cap_images(browser_params.custom_params["path"],webdriver,self.n)
        
def extractads(path,n):
    res  = {}
    for ssd in os.listdir(path):
        if('Header_Bidding'+str(n) in ssd):
            res = process_ad(res,path,ssd)
            print(res)
            for k,v in res.items():
                with open(path+'/{}.json'.format(str(n)+"_"+k),'w') as file:
                    json.dump(v, file, ensure_ascii=False, indent=3)
                with open(path+'/{}.html'.format(str(n)+"_"+k),'w') as file:
                    file.write(v['ad_html'])
            res = {}

def process_ad(res,path,ssd):
	sd = path.split("/")[-1]
	with open(os.path.join(path,ssd),'r') as ad:
		ads = []
		data = str(ad.read().encode('UTF-8'))
		
		## Preprocessing
		## Preprocessing

		data2 = data.split("}} ")
		data3 = []
		for item in data2[:-1]:
			data3.append(item+"}} ")
		data3.append(data2[-1])
		data4 = []
		for item in data3:
			data4.append(clean_json(item))

		## data4 now has list of ad jsons as strings
		## data4 now has list of ad jsons as strings
		
		index = 1
		for item in data4:
			ad_html = extract_ad_html(item)

			if(ad_html != -1):

				key = sd+'_'+str(index)
				res[key] = {}
				index += 1

				val  = extract_urls('img src=',item)
				val2 = extract_urls('a href=',item)
				res[key]['ad_html'] = ad_html
				res[key]['urls']	= val + val2

				
				

				extract_items 		= ["cpm","bidder","originalCurrency","pbHg","pbLg","pbCg","pbMg","pbAg","pbDg","currency","height","size","width","mediaType","bidderCode","originalCpm","statusMessage"]
				for i in extract_items:
					res[key][i]		= extract_item(i,item)

		return res
    
def extract_item(name,data,end_delim=[", ","}}"]):
	
	val = "not found"
	for i in range(len(data)):
		cap = ""
		dis = len(name)+4
		if(data[i:i+dis] == "'{}': ".format(name)):
			for j in range(i+dis, len(data)):
				if(data[j:j+2] == end_delim[0] or data[j:j+2] == end_delim[-1]):
					val = cap
					break
				cap += data[j]
		if(val != "not found"):
			break
	return val

def extract_urls(name,data,end_delim=['" ','">','><']):
	
	val = []
	for i in range(len(data)):
		cap = ""
		dis = len(name)
		if(data[i:i+dis] == "{}".format(name)):
			#print(data[i:i+dis])
			for j in range(i+dis, len(data)):
				if(data[j:j+2] == end_delim[0] or data[j:j+2] == end_delim[1] or data[j:j+2] == end_delim[2]):
					tmp = cap
					val.append(tmp.strip("/").strip("\\").strip('"').strip("/").strip("\\"))
					break
				cap += data[j]
	return val

def extract_ad_html(_str):
	
	ads = []
	for i in range(len(_str)):
			cap = ""
			if(_str[i:i+7] == "'ad': '"):
				for j in range(i+7, len(_str)):
					if(_str[j:j+3] == "', "):
						ads.append(cap)
						break
					cap += _str[j]
	new_ads = []
	for i in range(len(ads)):
		if(len(ads[i]) > 25):
			new_ads.append(ads[i])
	
	if(len(new_ads) > 0):
		return new_ads[0]
	return -1

def clean_json(data):
    return data.replace("u\\'","'").replace("\\'","'").replace("b'\\n","").replace(": True",": 'True'").replace(": False",": 'False'").replace(": None",": 'None'")
       


def cap_images(path,driver,n):

	for item in os.listdir(path): #for htmls
		try:
			if("html" not in item or int(item.split("_")[0]) != n):
				continue
			print(item)
			html_file = os.path.join(os.getcwd(),path,item)

			driver.get("file:///"+html_file)
			time.sleep(3)
			item_t = item.replace(".html","")
			driver.save_screenshot(path+"/{}_{}.png".format(str(n),item_t))
		
		except Exception as e:
			with open(path+'/{}_{}_error.txt'.format(str(n),item_t),'w') as file:
				file.write(str(e))


	for item in os.listdir(path): #for urls

#		hbno = int(item.split("_")[0])        
		if("json" not in item or 'RTB' in item or int(item.split("_")[0]) != n):
			continue
		print(item)

		json_file = os.path.join(path,item)
		with open(json_file,'r') as file:
			data = json.load(file)
			index2 = 1

			for url in data["urls"]:
				url = url.strip("'")
				url = url.strip("'")
				for i in range(10):
					url = url.strip("\\")
				try:
					site = url
# 					request = urllib2.Request(site,headers={'User-Agent':'Mozilla/5.0 (X11; U; Linux i686) Gecko/20071127 firefox/2.0.0.11'})
# 					page = urllib2.urlopen(request)
					req = urllib.request.Request(url,data=None, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.47 Safari/537.36'})
					page=urllib.request.urlopen(req)
					item_t = item.replace(".json","")
					file_name = "/{}_{}_url_{}".format(str(n),item_t,str(index2))
					with open(path+"/{}.png".format(file_name),'wb') as f:
						f.write(page.read())
					time.sleep(2)
						
				except Exception as e:
					print("Error")
					with open(path+"/{}_error_{}_url_{}.txt".format(str(n),item_t,str(index2)),'w') as file:
						file.write(str(e))
				index2 += 1

                
##################################### RTB AD FROM JSON SECTION ####################################################
##################################### RTB AD FROM JSON SECTION ####################################################
##################################### RTB AD FROM JSON SECTION ####################################################

class GetRTBAds(BaseCommand):
	"""This command gets RTB ads from the page currently visiting"""
	def __init__(self) -> None:
		self.logger = logging.getLogger("openwpm")

	# While this is not strictly necessary, we use the repr of a command for logging
	# So not having a proper repr will make your logs a lot less useful
	def __repr__(self) -> str:
		return "GettingRealTimeBiddingAd"
	# Have a look at openwpm.commands.types.BaseCommand.execute to see
	# an explanation of each parameter
	def execute(self,webdriver: Firefox,browser_params: BrowserParams,manager_params: ManagerParams,extension_socket: ClientSocket,) -> None:
		urls = rtb_ads(browser_params.custom_params["path"])
		index = 0
		print(urls)
		for site in urls:
			persona_path = browser_params.custom_params["path"]
			file_name = persona_path+"_RTB_image_{}".format(str(index))
			RTB_imgs(browser_params.custom_params["path"],file_name,site)
			index = index + 1
		return

def rtb_ads(path):
	new_path = path
	val = to_csv(new_path)
	if(val == -1):
		return
	df = pd.read_csv(new_path+'/tables/http_responses.csv')
	
	urls = []
	for index,row in df.iterrows():
		start = row['headers'].find('["Content-Type",')
		end = row['headers'].find("]",start)
		if(start == -1):
			continue

		if("image" not in row['headers'][start:end+1]):
			continue
		#print(row['url'])
		#urls.append(row['url'])
		if rules.should_block(row['url']):
			urls.append(row['url'])
	#print(urls)
	urls_tlds = []
	for url in urls:
		res = tldextract.extract(url)
		tld = res.domain
		sub = res.subdomain
		urls_tlds.append((tld,sub,url))
        
	with open(os.path.join(path,'RTB_urls.json'),'w') as file:
		json.dump(urls,file)
	return urls

def to_csv(path):
	if(os.path.exists(path+'/2_crawl-data.sqlite') == False):
		return -1
	if(os.path.exists(path+'/tables') == False):
		os.mkdir(path+'/tables')
	db = sqlite3.connect(path+'/2_crawl-data.sqlite')
	cursor = db.cursor()
	cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
	tables = cursor.fetchall()
	for table_name in tables:
		table_name = table_name[0]
		table = pd.read_sql_query("SELECT * from %s" % table_name, db)
		table.to_csv(path+'/tables/'+table_name + '.csv', index_label='index', encoding='utf-8')
	cursor.close()
	db.close()
	return 1

def RTB_imgs(path,file_name,site):
	time.sleep(3)
	try:
		print()
		print(site)
		print()
#		req = urllib.request.Request(site,data=None, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.47 Safari/537.36'})
#		page=urllib.request.urlopen(req)
		urllib.request.urlretrieve(site,path+"/{}.png".format(file_name.replace("data/Phase1/","")))
#		with open(path+"/{}.png".format(file_name),'wb') as f:
#			f.write(page.read())
	except Exception as e:
		print(str(e))
		print("[Finished with Error RTB_imgs]--------------------------------------")
		return
	print("[Finished RTB_imgs]--------------------------------------")
	return
