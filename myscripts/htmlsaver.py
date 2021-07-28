from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import ui
import time
import os


def makedriver():
	driver = webdriver.Firefox()
	return driver

def closedriver(d):
	d.quit()

def savehtmls(driver,p,name):
	driver.get('file:///'+p)
	driver.save_screenshot("../../"+name)


if __name__ == "__main__":

	driver = makedriver()
	data_path = "../data/runs/run1"
	for item in os.listdir(data_path):
		if(".html" in item):
			print(item)
			savehtmls(driver,os.path.join(os.getcwd(),data_path,item),item.replace("html","png"))
	closedriver(driver)