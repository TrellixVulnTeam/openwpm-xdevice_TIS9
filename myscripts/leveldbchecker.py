# import plyvel
# import os

# p = "../data/run4/datadir/leveldb3"
# p1= "../tables/run4/images3"

# if not os.path.exists(p1):
# 	os.mkdir(p1)

# db  = plyvel.DB(p)

# hashes = []
# with open("../tables/run4/tables3/Hashes.txt","r") as file:
# 	lines = file.readlines()
# 	for line in lines:
# 		hashes.append(line.strip('\n').strip('\r'))

# for index,item in enumerate(hashes):
# 	img = db.get(str.encode(item))

# 	print(str.encode(item))
# 	#print(img)

# 	if img == None:
# 		print("none")
# 		continue

# 	with open(p1+"/{}check.png".format(str(index)),"wb") as file:
# 		file.write(img)

# db.close()


import plyvel
import csv
import sqlite3
import os
import pandas as pd
import time
import subprocess
import csv
from tqdm import tqdm
import pickle as pk
import sys


rules_path   = "../data/files/rules.pkl"

rules = []
with open(rules_path,"rb") as file:
    rules = pk.load(file)


def to_csv(path,path2,m):
    if(os.path.exists(path+'/{}crawl-data.sqlite'.format(m)) == False):
        return -1
    if(os.path.exists(path2+'/tables'+m) == False):
        os.makedirs(path2+'/tables'+m)
    db = sqlite3.connect(path+'/{}crawl-data.sqlite'.format(m))
    cursor = db.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    for table_name in tables:
        table_name = table_name[0]
        table = pd.read_sql_query("SELECT * from %s" % table_name, db)
        table.to_csv(path2+'/tables'+m+'/'+table_name + '.csv', index_label='index', encoding='utf-8')
    cursor.close()
    db.close()
    return 1


def hashesfunc(p):
    hashes = []
    with open(p+"http_responses.csv","r") as file:
        reader = csv.reader(file,delimiter=",")
        for line in tqdm(reader):
            if "image" in line[15] and line[19] != "":
                if rules.should_block(line[10]):
                    hashes.append(line[19])
    with open(p+"Hashes.txt","w") as file:
        for item in hashes:
            file.write(item)
            file.write("\n")
        

def extractdbimg(p,p2,p3):
    db  = plyvel.DB(p)
    hashes = []
    with open(p2+"Hashes.txt","r") as file:
        lines = file.readlines()
        for line in lines:
            hashes.append(line.strip('\n').strip('\r'))
    if(os.path.exists(p3) == False):
        os.makedirs(p3)
    for index,item in enumerate(hashes):
        img = db.get(str.encode(item))
        
        if img == None:
            print("none")
            continue
        img_path = p3+"/{}check.png".format(str(index))
        with open(img_path,"wb") as file:
            file.write(img)
    db.close()



def runners(i):

    to_csv("../datadir{}".format(i),"../datadir{}".format(i),'1')
    hashesfunc("../datadir{}/tables1/".format(i))
    extractdbimg("../datadir{}/leveldb1".format(i),"../datadir{}/tables1/".format(i),"../datadir{}/images/m1/".format(i))
    #write a function to selenium open the hb ads and save them aagain


    to_csv("../datadir{}".format(i),"../datadir{}".format(i),'3')
    hashesfunc("../datadir{}/tables3/".format(i))
    extractdbimg("../datadir{}/leveldb3".format(i),"../datadir{}/tables3/".format(i),"../datadir{}/images/m3/".format(i))



for i in range(6,11):
    runners(str(i))