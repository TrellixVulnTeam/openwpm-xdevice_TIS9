import csv
import sqlite3
import os
import pandas as pd

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


to_csv("../data/runs/run2/","../data/tables/run2/",'1')
to_csv("../data/runs/run2/","../data/tables/run2/",'3')