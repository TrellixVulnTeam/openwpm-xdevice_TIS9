import json
import logging
import os.path
import socket
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from easyprocess import EasyProcessError
from multiprocess import Queue
from pyvirtualdisplay import Display
from selenium import webdriver

from ..commands.profile_commands import load_profile
from ..config import BrowserParamsInternal, ConfigEncoder, ManagerParamsInternal
from ..utilities.platform_utils import get_firefox_binary_path
from . import configure_firefox
from .selenium_firefox import FirefoxBinary, FirefoxLogInterceptor, Options

from selenium.webdriver.common.proxy import Proxy, ProxyType

logger = logging.getLogger("openwpm")


def deploy_firefox(
    status_queue: Queue,
    browser_params: BrowserParamsInternal,
    manager_params: ManagerParamsInternal,
    crash_recovery: bool,
) -> Tuple[webdriver.Firefox, Path, Optional[Display]]:
    """
    launches a firefox instance with parameters set by the input dictionary
    """
    DEFAULT_SCREEN_RES = (1224, 1000)
    if browser_params.custom_params['mobile']:
        DEFAULT_SCREEN_RES = (375, 667)

    firefox_binary_path = get_firefox_binary_path()

    root_dir = os.path.dirname(__file__)  # directory of this file

    browser_profile_path = Path(tempfile.mkdtemp(prefix="firefox_profile_"))
    status_queue.put(("STATUS", "Profile Created", browser_profile_path))

    # Use Options instead of FirefoxProfile to set preferences since the
    # Options method has no "frozen"/restricted options.
    # https://github.com/SeleniumHQ/selenium/issues/2106#issuecomment-320238039
    fo = Options()
    # Set a custom profile that is used in-place and is not deleted by geckodriver.
    # https://firefox-source-docs.mozilla.org/testing/geckodriver/CrashReports.html
    # Using FirefoxProfile breaks stateful crawling:
    # https://github.com/mozilla/OpenWPM/issues/423#issuecomment-521018093
    fo.add_argument("-profile")
    fo.add_argument(str(browser_profile_path))

    assert browser_params.browser_id is not None
    if browser_params.seed_tar and not crash_recovery:
        logger.info(
            "BROWSER %i: Loading initial browser profile from: %s"
            % (browser_params.browser_id, browser_params.seed_tar)
        )
        load_profile(
            browser_profile_path,
            browser_params,
            browser_params.seed_tar,
        )
    elif browser_params.recovery_tar:
        logger.debug(
            "BROWSER %i: Loading recovered browser profile from: %s"
            % (browser_params.browser_id, browser_params.recovery_tar)
        )
        load_profile(
            browser_profile_path,
            browser_params,
            browser_params.recovery_tar,
        )
    status_queue.put(("STATUS", "Profile Tar", None))

    display_mode = browser_params.display_mode
    display_pid = None
    display_port = None
    display = None
    if display_mode == "headless":
        fo.headless = True
        fo.add_argument("--width={}".format(DEFAULT_SCREEN_RES[0]))
        fo.add_argument("--height={}".format(DEFAULT_SCREEN_RES[1]))
    if display_mode == "xvfb":
        try:
            display = Display(visible=0, size=DEFAULT_SCREEN_RES)
            display.start()
            display_pid, display_port = display.pid, display.display
        except EasyProcessError:
            raise RuntimeError(
                "Xvfb could not be started. \
                Please ensure it's on your path. \
                See www.X.org for full details. \
                Commonly solved on ubuntu with `sudo apt install xvfb`"
            )
    # Must do this for all display modes,
    # because status_queue is read off no matter what.
    status_queue.put(("STATUS", "Display", (display_pid, display_port)))

    if browser_params.extension_enabled:
        # Write config file
        extension_config: Dict[str, Any] = dict()
        extension_config.update(browser_params.to_dict())
        extension_config["logger_address"] = manager_params.logger_address
        extension_config[
            "storage_controller_address"
        ] = manager_params.storage_controller_address
        extension_config["testing"] = manager_params.testing
        ext_config_file = browser_profile_path / "browser_params.json"
        with open(ext_config_file, "w") as f:
            json.dump(extension_config, f, cls=ConfigEncoder)
        logger.debug(
            "BROWSER %i: Saved extension config file to: %s"
            % (browser_params.browser_id, ext_config_file)
        )

        # TODO restore detailed logging
        # fo.set_preference("extensions.@openwpm.sdk.console.logLevel", "all")

    # Geckodriver currently places the user.js file in the wrong profile
    # directory, so we have to create it manually here.
    # TODO: See https://github.com/mozilla/OpenWPM/issues/867 for when
    # to remove this workaround.
    # Load existing preferences from the profile's user.js file
    prefs = configure_firefox.load_existing_prefs(browser_profile_path)
    # Load default geckodriver preferences
    prefs.update(configure_firefox.DEFAULT_GECKODRIVER_PREFS)
    # Pick an available port for Marionette (https://stackoverflow.com/a/2838309)
    # This has a race condition, as another process may get the port
    # before Marionette, but we don't expect it to happen often
    s = socket.socket()
    s.bind(("", 0))
    marionette_port = s.getsockname()[1]
    s.close()
    prefs["marionette.port"] = marionette_port

    # Configure privacy settings
    configure_firefox.privacy(browser_params, prefs)

    # Set various prefs to improve speed and eliminate traffic to Mozilla
    configure_firefox.optimize_prefs(prefs)



    ##### MAAZ CODE #####
    if browser_params.custom_params['mobile']:
        prefs = mobile_prefs(prefs)
        prefs["general.useragent.override"] = "Mozilla/5.0 (Android 11; Mobile; rv:68.0) Gecko/68.0 Firefox/89.0"
        

    # Intercept logging at the Selenium level and redirect it to the
    # main logger.
    interceptor = FirefoxLogInterceptor(browser_params.browser_id)
    interceptor.start()

    # Set custom prefs. These are set after all of the default prefs to allow
    # our defaults to be overwritten.
    for name, value in browser_params.prefs.items():
        logger.info(
            "BROWSER %i: Setting custom preference: %s = %s"
            % (browser_params.browser_id, name, value)
        )
        prefs[name] = value

    # Add Proxy if needed
    proxy = browser_params.custom_params['ip']
    print(proxy)
    if proxy != None:
        prefs["network.proxy.type"] = 1
        prefs["network.proxy.http"] = "34.130.54.137"
        prefs["network.proxy.http_port"] = 8888
        prefs["network.proxy.ftp"] = "34.130.54.137"
        prefs["network.proxy.ftp_port"] = 8888
        prefs["network.proxy.ssl"] = "34.130.54.137"
        prefs["network.proxy.ssl_port"] = 8888
        proxy = None

    # Write all preferences to the profile's user.js file
    configure_firefox.save_prefs_to_profile(prefs, browser_profile_path)

    if proxy != None:
        
        firefox_capabilities = webdriver.DesiredCapabilities.FIREFOX
        firefox_capabilities['marionette'] = True

        firefox_capabilities['proxy'] = {
            "proxyType":"manual",
            "httpProxy":proxy,
            "ftpProxy":proxy,
            "sslProxy":proxy,
        }

        # Launch the webdriver
        status_queue.put(("STATUS", "Launch Attempted", None))
        fb = FirefoxBinary(firefox_path=firefox_binary_path)
        driver = webdriver.Firefox(
            firefox_binary=fb,
            options=fo,
            log_path=interceptor.fifo,
            capabilities=firefox_capabilities,
            # TODO: See https://github.com/mozilla/OpenWPM/issues/867 for
            # when to remove this
            service_args=["--marionette-port", str(marionette_port)],
        )
    else:
        # Launch the webdriver
        status_queue.put(("STATUS", "Launch Attempted", None))
        fb = FirefoxBinary(firefox_path=firefox_binary_path)
        driver = webdriver.Firefox(
            firefox_binary=fb,
            options=fo,
            log_path=interceptor.fifo,
            # TODO: See https://github.com/mozilla/OpenWPM/issues/867 for
            # when to remove this
            service_args=["--marionette-port", str(marionette_port)],
        )

    # Add extension
    if browser_params.extension_enabled:

        # Install extension
        ext_loc = os.path.join(root_dir, "../Extension/firefox/openwpm.xpi")
        ext_loc = os.path.normpath(ext_loc)
        driver.install_addon(ext_loc, temporary=True)
        logger.debug(
            "BROWSER %i: OpenWPM Firefox extension loaded" % browser_params.browser_id
        )

    # set window size
    driver.set_window_size(DEFAULT_SCREEN_RES[0],DEFAULT_SCREEN_RES[1])

    # Get browser process pid
    if hasattr(driver, "service") and hasattr(driver.service, "process"):
        pid = driver.service.process.pid
    elif hasattr(driver, "binary") and hasattr(driver.binary, "process"):
        pid = driver.binary.process.pid
    else:
        raise RuntimeError("Unable to identify Firefox process ID.")

    status_queue.put(("STATUS", "Browser Launched", int(pid)))

    return driver, browser_profile_path, display


def mobile_prefs(prefs):

    color_depth=None
    oscpu=None
    platform = "android"
    if platform == "android":
        prefs["general.platform.override"]   = "Linux armv7l"
        prefs["general.appversion.override"] = "5.0 (Android 7.0)"
        color_depth = 24
        oscpu="Linux armv7l"


    prefs["toolkit.browser.cacheRatioWidth"]= 2000
    prefs["toolkit.browser.cacheRatioHeight"]= 3000

    #// How long before a content view (a handle to a remote scrollable object)
    #// expires.
    prefs["toolkit.browser.contentViewExpire"]= 3000

    prefs["toolkit.defaultChromeURI"]= "chrome://geckoview/content/geckoview.xhtml"
    prefs["browser.chromeURL"]= "chrome://browser/content/"

    #// If a tab has not been active for this long (seconds), then it may be
    #// turned into a zombie tab to preemptively free up memory. -1 disables time-based
    #// expiration (but low-memory conditions may still require the tab to be zombified).
    prefs["browser.tabs.expireTime"]= 900

    #// Disables zombification of background tabs under memory pressure.
    #// Intended for use in testing, where we don't want the tab running the
    #// test harness code to be zombified.
    prefs["browser.tabs.disableBackgroundZombification"]= False

    #// Control whether tab content should try to load from disk cache when network
    #// is offline.
    #// Controlled by Switchboard experiment "offline-cache".
    prefs["browser.tabs.useCache"]= False

    prefs["toolkit.zoomManager.zoomValues"]= ".2,.3,.5,.67,.8,.9,1,1.1,1.2,1.33,1.5,1.7,2,2.4,3,4"

    #// Mobile will use faster, less durable mode.
    prefs["toolkit.storage.synchronous"]= 0

    #// Android needs concurrent access to the same database from multiple processes,
    #// thus we can't use exclusive locking on it.
    prefs["storage.multiProcessAccess.enabled"]= True

    #// The default fallback zoom level to render pages at. Set to -1 to fit page; otherwise
    #// the value is divided by 1000 and clamped to hard-coded min/max scale values.
    prefs["browser.viewport.defaultZoom"]= -1

    #// Show/Hide scrollbars when active/inactive
    prefs["ui.showHideScrollbars"]= 1
    prefs["ui.useOverlayScrollbars"]= 1
    prefs["ui.scrollbarFadeBeginDelay"]= 450
    prefs["ui.scrollbarFadeDuration"]= 0

    #/* turn off the caret blink after 10 cycles */
    prefs["ui.caretBlinkCount"]= 10

    prefs["browser.cache.memory_limit"]= 5120

    #/* image cache prefs */
    prefs["image.cache.size"]= 1048576

    #/* offline cache prefs */
    prefs["browser.offline-apps.notify"]= True
    prefs["browser.cache.offline.capacity"]= 5120

    #/* disable some protocol warnings */
    prefs["network.protocol-handler.warn-external.tel"]= False
    prefs["network.protocol-handler.warn-external.sms"]= False
    prefs["network.protocol-handler.warn-external.mailto"]= False
    prefs["network.protocol-handler.warn-external.vnd.youtube"]= False

    #/* http prefs */
    prefs["network.http.keep-alive.timeout"]= 109
    prefs["network.http.max-persistent-connections-per-server"]= 6
    prefs["network.http.max-persistent-connections-per-proxy"]= 20

    #// spdy
    prefs["network.http.spdy.push-allowance"]= 32768
    prefs["network.http.spdy.default-hpack-buffer"]= 4096

    #// http3
    prefs["network.http.http3.default-qpack-table-size"]= 0

    #// See bug 545869 for details on why these are set the way they are
    prefs["network.buffer.cache.count"]= 24
    prefs["network.buffer.cache.size"]=  16384

    #// predictive actions
    prefs["network.predictor.max-db-size"]= 2097152
    prefs["network.predictor.preserve"]= 50

    #// Use JS mDNS as a fallback
    prefs["network.mdns.use_js_fallback"]= False

    #/* How many times should have passed before the remote tabs list is refreshed */
    prefs["browser.display.remotetabs.timeout"]= 10

    #/* session history */
    prefs["browser.sessionhistory.max_total_viewers"]= -1
    prefs["browser.sessionhistory.max_entries"]= 50
    prefs["browser.sessionhistory.contentViewerTimeout"]= 360
    prefs["browser.sessionhistory.bfcacheIgnoreMemoryPressure"]= False

    #/* session store */
    prefs["browser.sessionstore.resume_from_crash"]= True
    prefs["browser.sessionstore.interval"]= 10000
    prefs["browser.sessionstore.backupInterval"]= 120000
    prefs["browser.sessionstore.max_tabs_undo"]= 10
    prefs["browser.sessionstore.max_resumed_crashes"]= 2
    prefs["browser.sessionstore.privacy_level"]= 0

    #// Download protection lists are not available on Fennec.
    prefs["urlclassifier.downloadAllowTable"]= ""
    prefs["urlclassifier.downloadBlockTable"]= ""

    #/* these should help performance */
    prefs["layout.css.report_errors"]= False

    #/* download manager (don't show the window or alert) */
    prefs["browser.download.useDownloadDir"]= True
    prefs["browser.download.folderList"]= 1
    prefs["browser.download.manager.addToRecentDocs"]= True

    #/* download helper */
    prefs["browser.helperApps.deleteTempFileOnExit"]= False

    #/* password manager */
    prefs["signon.rememberSignons"]= True
    prefs["signon.autofillForms.http"]= True
    prefs["signon.expireMasterPassword"]= False
    prefs["signon.debug"]= False

    #/* form helper (scroll to and optionally zoom into editable fields)  */
    prefs["formhelper.autozoom"]= True

    #/* find helper */
    prefs["findhelper.autozoom"]= True

    #/* autocomplete */
    prefs["browser.formfill.enable"]= True

    #/* spellcheck */
    prefs["layout.spellcheckDefault"]= 0

    #/* new html5 forms */
    prefs["dom.forms.datetime.others"]= True

    #/* extension manager and xpinstall */
    prefs["xpinstall.whitelist.fileRequest"]= False
    prefs["xpinstall.whitelist.add"]= "https://addons.mozilla.org"

    prefs["extensions.langpacks.signatures.required"]= True
    prefs["xpinstall.signatures.required"]= True

    #// Disable add-ons that are not installed by the user in all scopes by default (See the SCOPE
    #// constants in AddonManager.jsm for values to use here, and Bug 1405528 for a rationale).
    prefs["extensions.autoDisableScopes"]= 15

    prefs["extensions.enabledScopes"]= 5
    prefs["extensions.autoupdate.enabled"]= True
    prefs["extensions.autoupdate.interval"]= 86400
    prefs["extensions.update.enabled"]= True
    prefs["extensions.update.interval"]= 86400
    prefs["extensions.dss.enabled"]= False
    prefs["extensions.ignoreMTimeChanges"]= False
    prefs["extensions.logging.enabled"]= False
    prefs["extensions.hideInstallButton"]= True
    prefs["extensions.hideUpdateButton"]= False
    prefs["extensions.strictCompatibility"]= False
    prefs["extensions.minCompatibleAppVersion"]= "11.0"

    prefs["extensions.update.url"]= "https://versioncheck.addons.mozilla.org/update/VersionCheck.php?reqVersion=%REQ_VERSION%&id=%ITEM_ID%&version=%ITEM_VERSION%&maxAppVersion=%ITEM_MAXAPPVERSION%&status=%ITEM_STATUS%&appID=%APP_ID%&appVersion=%APP_VERSION%&appOS=%APP_OS%&appABI=%APP_ABI%&locale=%APP_LOCALE%&currentAppVersion=%CURRENT_APP_VERSION%&updateType=%UPDATE_TYPE%&compatMode=%COMPATIBILITY_MODE%"
    prefs["extensions.update.background.url"]= "https://versioncheck-bg.addons.mozilla.org/update/VersionCheck.php?reqVersion=%REQ_VERSION%&id=%ITEM_ID%&version=%ITEM_VERSION%&maxAppVersion=%ITEM_MAXAPPVERSION%&status=%ITEM_STATUS%&appID=%APP_ID%&appVersion=%APP_VERSION%&appOS=%APP_OS%&appABI=%APP_ABI%&locale=%APP_LOCALE%&currentAppVersion=%CURRENT_APP_VERSION%&updateType=%UPDATE_TYPE%&compatMode=%COMPATIBILITY_MODE%"

    #/* preferences for the Get Add-ons pane */
    prefs["extensions.getAddons.cache.enabled"]= True
    prefs["extensions.getAddons.search.browseURL"]= "https://addons.mozilla.org/%LOCALE%/android/search?q=%TERMS%&platform=%OS%&appver=%VERSION%"
    prefs["extensions.getAddons.browseAddons"]= "https://addons.mozilla.org/%LOCALE%/android/collections/4757633/mob/?page=1&collection_sort=-popularity"
    prefs["extensions.getAddons.get.url"]= "https://services.addons.mozilla.org/api/v4/addons/search/?guid=%IDS%&lang=%LOCALE%"
    prefs["extensions.getAddons.langpacks.url"]= "https://services.addons.mozilla.org/api/v4/addons/language-tools/?app=android&type=language&appversion=%VERSION%"

    #/* preference for the locale picker */
    prefs["extensions.getLocales.get.url"]= ""
    prefs["extensions.compatability.locales.buildid"]= "0"

    #/* Don't let XPIProvider install distribution add-ons; we do our own thing on mobile. */
    prefs["extensions.installDistroAddons"]= False

    prefs["extensions.webextPermissionPrompts"]= True
    prefs["extensions.webextOptionalPermissionPrompts"]= True

    #// Add-on content security policies.
    prefs["extensions.webextensions.base-content-security-policy"]= "script-src 'self' https://* moz-extension: blob: filesystem: 'unsafe-eval' 'unsafe-inline'; object-src 'self' https://* moz-extension: blob: filesystem:;"
    prefs["extensions.webextensions.default-content-security-policy"]= "script-src 'self'; object-src 'self';"

    prefs["extensions.webextensions.background-delayed-startup"]= True

    ######### prefs["extensions.experiments.enabled"]= False

    # #/* block popups by default, and notify the user about blocked popups */
    ######### prefs["dom.disable_open_during_load"]= True
    prefs["privacy.popups.showBrowserMessage"]= True

    #/* disable opening windows with the dialog feature */
    prefs["dom.disable_window_open_dialog_feature"]= True
    prefs["dom.disable_window_find"]= True

    prefs["keyword.enabled"]= True
    prefs["browser.fixup.domainwhitelist.localhost"]= True

    prefs["accessibility.typeaheadfind"]= False
    prefs["accessibility.typeaheadfind.timeout"]= 5000
    prefs["accessibility.typeaheadfind.flashBar"]= 1
    prefs["accessibility.typeaheadfind.linksonly"]= False
    prefs["accessibility.typeaheadfind.casesensitive"]= 0
    prefs["accessibility.browsewithcaret_shortcut.enabled"]= False
    prefs["findbar.matchdiacritics"]= 0

    #// Whether the character encoding menu is under the main Firefox button. This
    #// preference is a string so that localizers can alter it.
    prefs["browser.menu.showCharacterEncoding"]= "chrome://browser/locale/browser.properties"

    #// SSL error page behaviour
    prefs["browser.ssl_override_behavior"]= 2
    prefs["browser.xul.error_pages.expert_bad_cert"]= False

    #// Market-specific search defaults
    prefs["browser.search.geoSpecificDefaults"]= True
    prefs["browser.search.geoSpecificDefaults.url"]= "https://search.services.mozilla.com/1/%APP%/%VERSION%/%CHANNEL%/%LOCALE%/%REGION%/%DISTRIBUTION%/%DISTRIBUTION_VERSION%"

    #// disable updating
    prefs["browser.search.update"]= False

    #// disable search suggestions by default
    prefs["browser.search.suggest.enabled"]= False
    prefs["browser.search.suggest.prompted"]= False

    #// tell the search service that we don't really expose the "current engine"
    prefs["browser.search.noCurrentEngine"]= True

    #// Control media casting & mirroring features
    prefs["browser.casting.enabled"]= True

    #// Enable sparse localization by setting a few package locale overrides
    prefs["chrome.override_package.global"]= "browser"
    prefs["chrome.override_package.mozapps"]= "browser"
    prefs["chrome.override_package.passwordmgr"]= "browser"

    #// disable color management
    prefs["gfx.color_management.mode"]= 0

    #// 0=fixed margin, 1=velocity bias, 2=dynamic resolution, 3=no margins, 4=prediction bias
    prefs["gfx.displayport.strategy"]= 1

    #// all of the following displayport strategy prefs will be divided by 1000
    #// to obtain some multiplier which is then used in the strategy.
    #// fixed margin strategy options
    prefs["gfx.displayport.strategy_fm.multiplier"]= -1
    prefs["gfx.displayport.strategy_fm.danger_x"]= -1
    prefs["gfx.displayport.strategy_fm.danger_y"]= -1
    #// velocity bias strategy options
    prefs["gfx.displayport.strategy_vb.multiplier"]= -1
    prefs["gfx.displayport.strategy_vb.threshold"]= -1
    prefs["gfx.displayport.strategy_vb.reverse_buffer"]= -1
    prefs["gfx.displayport.strategy_vb.danger_x_base"]= -1
    prefs["gfx.displayport.strategy_vb.danger_y_base"]= -1
    prefs["gfx.displayport.strategy_vb.danger_x_incr"]= -1
    prefs["gfx.displayport.strategy_vb.danger_y_incr"]= -1

    #// prediction bias strategy options
    prefs["gfx.displayport.strategy_pb.threshold"]= -1

    #// don't allow JS to move and resize existing windows
    prefs["dom.disable_window_move_resize"]= True

    #// open in tab preferences
    #// 0=default window, 1=current window/tab, 2=new window, 3=new tab in most window
    prefs["browser.link.open_external"]= 3
    prefs["browser.link.open_newwindow"]= 3
    #// 0=force all new windows to tabs, 1=don't force, 2=only force those with no features set
    prefs["browser.link.open_newwindow.restriction"]= 0

    #// show images option
    #// 0=never, 1=always, 2=cellular-only
    prefs["browser.image_blocking"]= 1

    #// controls which bits of private data to clear. by default we clear them all.
    prefs["privacy.item.cache"]= True
    prefs["privacy.item.cookies"]= True
    prefs["privacy.item.offlineApps"]= True
    prefs["privacy.item.history"]= True
    prefs["privacy.item.searchHistory"]= True
    prefs["privacy.item.formdata"]= True
    prefs["privacy.item.downloads"]= True
    prefs["privacy.item.passwords"]= True
    prefs["privacy.item.sessions"]= True
    prefs["privacy.item.geolocation"]= True
    prefs["privacy.item.siteSettings"]= True
    prefs["privacy.item.syncAccount"]= True

    #// content sink control -- controls responsiveness during page load
    #// see https://bugzilla.mozilla.org/show_bug.cgi?id=481566#c9
    #//prefs["content.sink.enable_perf_mode"]=  2 // 0 - switch, 1 - interactive, 2 - perf
    #//prefs["content.sink.pending_event_mode"]= 0
    #//prefs["content.sink.perf_deflect_count"]= 1000000
    #//prefs["content.sink.perf_parse_time"]= 50000000

    prefs["javascript.options.mem.high_water_mark"]= 32

    prefs["dom.max_chrome_script_run_time"]= 0
    prefs["dom.max_script_run_time"]= 20

    #// Absolute path to the devtools unix domain socket file used
    #// to communicate with a usb cable via adb forward.
    prefs["devtools.debugger.unix-domain-socket"]= "@ANDROID_PACKAGE_NAME@/firefox-debugger-socket"

    prefs["devtools.remote.usb.enabled"]= False
    prefs["devtools.remote.wifi.enabled"]= False

    prefs["ui.touch.radius.enabled"]= False
    prefs["ui.touch.radius.leftmm"]= 3
    prefs["ui.touch.radius.topmm"]= 5
    prefs["ui.touch.radius.rightmm"]= 3
    prefs["ui.touch.radius.bottommm"]= 2
    prefs["ui.touch.radius.visitedWeight"]= 120

    prefs["ui.mouse.radius.enabled"]= True
    prefs["ui.mouse.radius.leftmm"]= 3
    prefs["ui.mouse.radius.topmm"]= 5
    prefs["ui.mouse.radius.rightmm"]= 3
    prefs["ui.mouse.radius.bottommm"]= 2
    prefs["ui.mouse.radius.visitedWeight"]= 120
    prefs["ui.mouse.radius.reposition"]= True

    #// Maximum distance from the point where the user pressed where we still
    #// look for text to select
    prefs["browser.ui.selection.distance"]= 250

    #// plugins
    prefs["plugin.disable"]= True
    prefs["dom.ipc.plugins.enabled"]= False

    #// product URLs
    #// The breakpad report server to link to in about:crashes
    prefs["breakpad.reportURL"]= "https://crash-stats.mozilla.org/report/index/"

    prefs["app.support.baseURL"]= "https://support.mozilla.org/1/mobile/%VERSION%/%OS%/%LOCALE%/"
    prefs["app.supportURL"]= "https://support.mozilla.org/1/mobile/%VERSION%/%OS%/%LOCALE%/mobile-help"
    prefs["app.faqURL"]= "https://support.mozilla.org/1/mobile/%VERSION%/%OS%/%LOCALE%/faq"

    #// URL for feedback page
    #// This should be kept in sync with the "feedback_link" string defined in strings.xml.in
    prefs["app.feedbackURL"]= "https://input.mozilla.org/feedback/android/%VERSION%/%CHANNEL%/?utm_source=feedback-prompt"

    prefs["app.privacyURL"]= "https://www.mozilla.org/privacy/firefox/"
    prefs["app.creditsURL"]= "https://www.mozilla.org/credits/"
    prefs["app.channelURL"]= "https://www.mozilla.org/%LOCALE%/firefox/channel/"


    #// Name of alternate about: page for certificate errors (when undefined, defaults to about:neterror)
    prefs["security.alternate_certificate_error_page"]= "certerror"

    prefs["security.warn_viewing_mixed"]= False

    #// Enable pinning
    prefs["security.cert_pinning.enforcement_level"]= 1

    #// Only fetch OCSP for EV certificates
    prefs["security.OCSP.enabled"]= 2

    #/* prefs used by the update timer system (including blocklist pings) */
    prefs["app.update.timerFirstInterval"]= 30000
    prefs["app.update.timerMinimumDelay"]= 30

    #// used by update service to decide whether or not to
    #// automatically download an update
    prefs["app.update.autodownload"]= "wifi"
    prefs["app.update.url.android"]= "https://aus5.mozilla.org/update/4/%PRODUCT%/%VERSION%/%BUILD_ID%/%BUILD_TARGET%/%LOCALE%/%CHANNEL%/%OS_VERSION%/%DISTRIBUTION%/%DISTRIBUTION_VERSION%/%MOZ_VERSION%/update.xml"

    #// threshold where a tap becomes a drag, in 1/240" reference pixels
    #// The names of the preferences are to be in sync with EventStateManager.cpp
    prefs["ui.dragThresholdX"]= 25
    prefs["ui.dragThresholdY"]= 25

    prefs["layers.async-video.enabled"]= True

    #// APZ physics settings (fling acceleration, fling curving and axis lock) have
    #// been reviewed by UX
    prefs["apz.axis_lock.breakout_angle"]= "0.7853982"
    prefs["apz.axis_lock.mode"]= 1
    prefs["apz.content_response_timeout"]= 600
    prefs["apz.drag.enabled"]= False
    prefs["apz.fling_accel_interval_ms"]= 750
    prefs["apz.fling_curve_function_x1"]= "0.59"
    prefs["apz.fling_curve_function_y1"]= "0.46"
    prefs["apz.fling_curve_function_x2"]= "0.05"
    prefs["apz.fling_curve_function_y2"]= "1.00"
    prefs["apz.fling_curve_threshold_inches_per_ms"]= "0.01"
  
    #// apz.fling_friction and apz.fling_stopped_threshold are currently ignored by Fennec.
    prefs["apz.fling_friction"]= "0.004"
    prefs["apz.fling_stopped_threshold"]= "0.0"
    prefs["apz.max_velocity_inches_per_ms"]= "0.07"
    prefs["apz.overscroll.enabled"]= True
    prefs["apz.second_tap_tolerance"]= "0.3"
    prefs["apz.touch_move_tolerance"]= "0.03"
    prefs["apz.touch_start_tolerance"]= "0.06"

    #// Enable the Visual Viewport API
    prefs["dom.visualviewport.enabled"]= True

    prefs["layers.progressive-paint"]= True
    prefs["layers.low-precision-buffer"]= True
    # // We want to limit layers for two reasons:
    # // 1) We can't scroll smoothly if we have to many draw calls
    # // 2) Pages that have too many layers consume too much memory and crash.
    # // By limiting the number of layers on mobile we're making the main thread
    # // work harder keep scrolling smooth and memory low.
    prefs["layers.max-active"]= 20

    prefs["notification.feature.enabled"]= True

    #// prevent tooltips from showing up
    prefs["browser.chrome.toolbar_tips"]= False

    #// don't allow meta-refresh when backgrounded
    prefs["browser.meta_refresh_when_inactive.disabled"]= True

    #// On mobile we throttle the download once the readahead_limit is hit
    #// if we're using a cellular connection, even if the download is slow.
    #// This is to preserve battery and data.
    prefs["media.throttle-cellular-regardless-of-download-rate"]= True

    #// Number of video frames we buffer while decoding video.
    #// On Android this is decided by a similar value which varies for
    #// each OMX decoder |OMX_PARAM_PORTDEFINITIONTYPE::nBufferCountMin|. This
    #// number must be less than the OMX equivalent or gecko will think it is
    #// chronically starved of video frames. All decoders seen so far have a value
    #// of at least 4.
    prefs["media.video-queue.default-size"]= 3
    #// The maximum number of queued frames to send to the compositor.
    #// On Android, it needs to be throttled because SurfaceTexture contains only one
    #// (the most recent) image data.
    prefs["media.video-queue.send-to-compositor-size"]= 1

    prefs["media.mediadrm-widevinecdm.visible"]= True

    #// Set Fennec to block autoplay by default.
    prefs["media.autoplay.default"]= 1

    #// Enable WebSpeech speech synthesis
    prefs["media.webspeech.synth.enabled"]= True

    #// OpenH264 is visible in about:plugins, and enabled, by default.
    prefs["media.gmp-gmpopenh264.visible"]= True
    prefs["media.gmp-gmpopenh264.enabled"]= True

    #// Disable future downloads of OpenH264 on Android
    prefs["media.gmp-gmpopenh264.autoupdate"]= False

    #// The download protection UI is not implemented yet (bug 1239094).
    prefs["browser.safebrowsing.downloads.enabled"]= False

    #// The application reputation lists are not available on Android.
    prefs["urlclassifier.downloadAllowTable"]= ""
    prefs["urlclassifier.downloadBlockTable"]= ""

    #// The Potentially Harmful Apps list replaces the malware one on Android.
    prefs["urlclassifier.malwareTable"]= "goog-harmful-proto,goog-unwanted-proto,moztest-harmful-simple,moztest-malware-simple,moztest-unwanted-simple"

    #// True if you always want dump() to work
    #//
    #// On Android, you also need to do the following for the output
    #// to show up in logcat:
    #//
    #// $ adb shell stop
    #// $ adb shell setprop log.redirect-stdio True
    #// $ adb shell start
    prefs["browser.dom.window.dump.enabled"]= True
    prefs["devtools.console.stdout.chrome"]= True

    #// controls if we want camera support
    prefs["device.camera.enabled"]= True
    prefs["media.realtime_decoder.enabled"]= True

    prefs["javascript.options.showInConsole"]= True

    prefs["full-screen-api.enabled"]= True

    prefs["direct-texture.force.enabled"]= False
    prefs["direct-texture.force.disabled"]= False

    #// This fraction in 1000ths of velocity remains after every animation frame when the velocity is low.
    prefs["ui.scrolling.friction_slow"]= -1
    #// This fraction in 1000ths of velocity remains after every animation frame when the velocity is high.
    prefs["ui.scrolling.friction_fast"]= -1
    #// The maximum velocity change factor between events, per ms, in 1000ths.
    #// Direction changes are excluded.
    prefs["ui.scrolling.max_event_acceleration"]= -1
    #// The rate of deceleration when the surface has overscrolled, in 1000ths.
    prefs["ui.scrolling.overscroll_decel_rate"]= -1
    #// The fraction of the surface which can be overscrolled before it must snap back, in 1000ths.
    prefs["ui.scrolling.overscroll_snap_limit"]= -1
    #// The minimum amount of space that must be present for an axis to be considered scrollable,
    #// in 1/1000ths of pixels.
    prefs["ui.scrolling.min_scrollable_distance"]= -1
    #// The axis lock mode for panning behaviour - set between standard, free and sticky
    prefs["ui.scrolling.axis_lock_mode"]= "standard"
    #// Determine the dead zone for gamepad joysticks. Higher values result in larger dead zones; use a negative value to
    #// auto-detect based on reported hardware values
    prefs["ui.scrolling.gamepad_dead_zone"]= 115

    #// Prefs for fling acceleration
    prefs["ui.scrolling.fling_accel_interval"]= -1
    prefs["ui.scrolling.fling_accel_base_multiplier"]= -1
    prefs["ui.scrolling.fling_accel_supplemental_multiplier"]= -1

    #// Prefs for fling curving
    prefs["ui.scrolling.fling_curve_function_x1"]= -1
    prefs["ui.scrolling.fling_curve_function_y1"]= -1
    prefs["ui.scrolling.fling_curve_function_x2"]= -1
    prefs["ui.scrolling.fling_curve_function_y2"]= -1
    prefs["ui.scrolling.fling_curve_threshold_velocity"]= -1
    prefs["ui.scrolling.fling_curve_max_velocity"]= -1
    prefs["ui.scrolling.fling_curve_newton_iterations"]= -1

    #// Enable accessibility mode if platform accessibility is enabled.
    prefs["accessibility.accessfu.activate"]= 2
    prefs["accessibility.accessfu.quicknav_modes"]= "Link,Heading,FormElement,Landmark,ListItem"
    #// Active quicknav mode, index value of list from quicknav_modes
    prefs["accessibility.accessfu.quicknav_index"]= 0
    #// Setting for an utterance order (0 - description first, 1 - description last).
    prefs["accessibility.accessfu.utterance"]= 1
    #// Whether to skip images with empty alt text
    prefs["accessibility.accessfu.skip_empty_images"]= True

    #// Transmit UDP busy-work to the LAN when anticipating low latency
    #// network reads and on wifi to mitigate 802.11 Power Save Polling delays
    prefs["network.tickle-wifi.enabled"]= True

    #// Mobile manages state by autodetection
    prefs["network.manage-offline-status"]= True

    #// Media plugins for libstagefright playback on android
    prefs["media.plugins.enabled"]= True

    #// Stagefright's OMXCodec::CreationFlags. The interesting flag values are:
    #//  0 = Let Stagefright choose hardware or software decoding (default)
    #//  8 = Force software decoding
    #// 16 = Force hardware decoding
    prefs["media.stagefright.omxcodec.flags"]= 0

    prefs["layers.enable-tiles"]= True

    #// Enable the dynamic toolbar
    prefs["browser.chrome.dynamictoolbar"]= True

    #// Location Bar AutoComplete.
    prefs["browser.urlbar.autocomplete.enabled"]= True

    #// Hide common parts of URLs like "www." or "http://"
    prefs["browser.urlbar.trimURLs"]= True

    #// initial web feed readers list
    prefs["browser.contentHandlers.types.0.title"]= "chrome://browser/locale/region.properties"
    prefs["browser.contentHandlers.types.0.uri"]= "chrome://browser/locale/region.properties"
    prefs["browser.contentHandlers.types.0.type"]= "application/vnd.mozilla.maybe.feed"
    prefs["browser.contentHandlers.types.1.title"]= "chrome://browser/locale/region.properties"
    prefs["browser.contentHandlers.types.1.uri"]= "chrome://browser/locale/region.properties"
    prefs["browser.contentHandlers.types.1.type"]= "application/vnd.mozilla.maybe.feed"
    prefs["browser.contentHandlers.types.2.title"]= "chrome://browser/locale/region.properties"
    prefs["browser.contentHandlers.types.2.uri"]= "chrome://browser/locale/region.properties"
    prefs["browser.contentHandlers.types.2.type"]= "application/vnd.mozilla.maybe.feed"
    prefs["browser.contentHandlers.types.3.title"]= "chrome://browser/locale/region.properties"
    prefs["browser.contentHandlers.types.3.uri"]= "chrome://browser/locale/region.properties"
    prefs["browser.contentHandlers.types.3.type"]= "application/vnd.mozilla.maybe.feed"

    #// Shortnumber matching needed for e.g. Brazil:
    #// 01187654321 can be found with 87654321
    prefs["dom.phonenumber.substringmatching.BR"]= 8
    prefs["dom.phonenumber.substringmatching.CO"]= 10
    prefs["dom.phonenumber.substringmatching.VE"]= 7

    prefs["gfx.canvas.azure.backends"]= "skia"

    #// When True, phone number linkification is enabled.
    prefs["browser.ui.linkify.phone"]= False

    #// Enables/disables Spatial Navigation
    prefs["snav.enabled"]= True

    #// The mode of home provider syncing.
    #// 0: Sync always
    #// 1: Sync only when on wifi
    prefs["home.sync.updateMode"]= 0

    #// How frequently to check if we should sync home provider data.
    prefs["home.sync.checkIntervalSecs"]= 3600

    #// Enable device storage API
    prefs["device.storage.enabled"]= True

    #// Enable meta-viewport support for font inflation code
    prefs["dom.meta-viewport.enabled"]= True

    #// Enable GMP support in the addon manager.
    prefs["media.gmp-provider.enabled"]= True

    #// The default color scheme in reader mode (light, dark, auto)
    #// auto = color automatically adjusts according to ambient light level
    #// (auto only works on platforms where the 'devicelight' event is enabled)
    #// auto doesn't work: https://bugzilla.mozilla.org/show_bug.cgi?id=1472957
    #// prefs["reader.color_scheme"]= "auto"
    prefs["reader.color_scheme"]= "light"

    #// Color scheme values available in reader mode UI.
    #// prefs["reader.color_scheme.values"]= "[\"dark\"]=\"auto\"]=\"light\"]"
    prefs["reader.color_scheme.values"]= "[\"dark\"]=\"sepia\"]=\"light\"]"

    #// Whether to use a vertical or horizontal toolbar.
    prefs["reader.toolbar.vertical"]= False

    #// Telemetry settings.
    #// Whether to use the unified telemetry behavior, requires a restart.
    prefs["toolkit.telemetry.unified"]= False

    #// AccessibleCaret CSS for the Android L style assets.
    prefs["layout.accessiblecaret.width"]= "22.0"
    prefs["layout.accessiblecaret.height"]= "22.0"
    prefs["layout.accessiblecaret.margin-left"]= "-11.5"

    #// Android needs to show the caret when long tapping on an empty content.
    prefs["layout.accessiblecaret.caret_shown_when_long_tapping_on_empty_content"]= True

    #// Androids carets are always tilt to match the text selection guideline.
    prefs["layout.accessiblecaret.always_tilt"]= True

    #// Update any visible carets for selection changes due to JS calls,
    #// but don't show carets if carets are hidden.
    prefs["layout.accessiblecaret.script_change_update_mode"]= 1

    #// Optionally provide haptic feedback on longPress selection events.
    prefs["layout.accessiblecaret.hapticfeedback"]= True

    #// Initial text selection on long-press is enhanced to provide
    #// a smarter phone-number selection for direct-dial ActionBar action.
    prefs["layout.accessiblecaret.extend_selection_for_phone_number"]= True

    prefs["dom.serviceWorkers.enabled"]= True

    #// Allow service workers to open windows for a longer period after a notification
    #// click on mobile.  This is to account for some devices being quite slow.
    prefs["dom.serviceWorkers.disable_open_click_delay"]= 5000

    prefs["dom.push.debug"]= False
    prefs["dom.push.maxRecentMessageIDsPerSubscription"]= 0

    prefs["dom.audiochannel.mediaControl"]= True

    prefs["media.openUnsupportedTypeWithExternalApp"]= True

    #// Ask for permission when enumerating WebRTC devices.
    prefs["media.navigator.permission.device"]= True

    #// Allow system add-on updates
    prefs["extensions.systemAddon.update.url"]= "https://aus5.mozilla.org/update/3/SystemAddons/%VERSION%/%BUILD_ID%/%BUILD_TARGET%/%LOCALE%/%CHANNEL%/%OS_VERSION%/%DISTRIBUTION%/%DISTRIBUTION_VERSION%/update.xml"
    prefs["extensions.systemAddon.update.enabled"]= True

    #// E10s stuff. We don't support 'file' or 'priveleged' process types.
    prefs["browser.tabs.remote.separateFileUriProcess"]= False
    prefs["browser.tabs.remote.separatePrivilegedContentProcess"]= False
    prefs["browser.tabs.remote.enforceRemoteTypeRestrictions"]= False

    #// Allow Web Authentication
    prefs["security.webauth.webauthn_enable_android_fido2"]= True
    prefs["browser.tabs.remote.separatePrivilegedMozillaWebContentProcess"]= False

    return prefs
