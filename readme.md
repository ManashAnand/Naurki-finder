# 🚀 Naukri Company Site Scanner

A Manifest V3 Chrome Extension that automates extracting **official company career page URLs** from Naukri job listings, tracks application statuses, caches scan results to minimize redundant requests, and exports actionable job data to CSV.

## ✨ Features

- 🔍 **Automated Page Scanning**: Scans active Naukri search result pages and job cards in real time.
- 🌐 **Direct URL Extraction**: Captures direct external company career/ATS links (Workday, Greenhouse, Lever, etc.).
- 💾 **Local Caching**: Stores scan results locally using chrome.storage.local to prevent duplicate scanning.
- 📋 **Application Tracking**: Differentiates between applied and pending opportunities.
- 📤 **CSV Export**: Generate customized CSV reports (Pending Jobs or Complete Job Audit).
- 🗑️ **Cache & State Management**: Clear cached job records and reset live progress counters on demand.
- 📊 **Real-time Stats**: Track cached listings, company-apply counts, and last scan timestamps directly from the popup UI.

## 🛠️ Architecture Overview

Plaintext

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML `+----------------------+                      |      popup.html      |                      |    (Extension UI)    |                      +----------+-----------+                                 |                                 | User Triggers                                 v                      +----------------------+                      |       popup.js       |                      |  UI Event Handlers   |                      +----------+-----------+                                 |                     chrome.runtime.sendMessage()                                 |                                 v            +-----------------------------------+            |           background.js           |            |   (MV3 Service Worker Controller) |            +-----------------------------------+               |               |               |               |               |               |               v               v               v     +----------------+ +---------------+ +----------------+     | Chrome Storage | |  Active Tab   | | Downloads API  |     | Cache & Stats  | | Content Script| | CSV Generation |     +-------+--------+ +-------+-------+ +----------------+             |                  |             |                  v             |        +-------------------+             |        |     script.js     |             |        |  (Content Script) |             +------- |  DOM Extraction   |        Stores Cache  +-------------------+`

## 📁 Project Structure

Plaintext

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   .  ├── manifest.json       # Manifest V3 extension configuration  ├── popup.html          # Extension popup user interface  ├── popup.js            # UI logic, state rendering, and background messaging  ├── popup.css           # Styling for the popup interface  ├── background.js       # Service worker managing storage, messages, and exports  ├── script.js           # Content script for target DOM extraction on Naukri  ├── icons/              # Extension icons (16px, 48px, 128px)  └── README.md           # Project documentation   `

## ⚙️ Component Responsibilities

### 1\. popup.js (UI Layer)

- Handles user interactions (Scan, Download CSV, Clear Cache).
- Listens for real-time progress runtime messages to update scan counts and status indicators.
- Queries chrome.storage.local to display total cached jobs and last scan timestamps.

### 2\. background.js (Service Worker / Controller)

- Serves as the central state manager and message router.
- Handles asynchronous requests to chrome.storage.local.
- Assembles CSV strings from stored job metadata and triggers file downloads via chrome.downloads.

### 3\. script.js (Content Script)

- Executes within the context of active Naukri web pages.
- Parses job cards, extracts embedded external links or redirects, and returns dynamic DOM payload updates back to background.js.

## 🔄 Core Workflows

### Scan Flow

Plaintext

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   User clicks "Scan Current Tab"              │              ▼  popup.js triggers runtime message              │              ▼  background.js injects / signals script.js              │              ▼  script.js parses DOM for Company Apply URLs              │              ▼  background.js updates cache & broadcasts progress              │              ▼  popup.html updates live UI counters   `

### Export Flow

Plaintext

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   User selects Download (Pending / All)              │              ▼  background.js fetches jobCache & appliedJobs              │              ▼  Filters / sorts records based on export type              │              ▼  Encodes dataset to CSV data URI & triggers chrome.downloads   `

## 📦 Installation & Local Setup

1.  Bashgit clone https://github.com/your-username/naukri-company-site-scanner.git
2.  Open Google Chrome and navigate to chrome://extensions/.
3.  Enable **Developer mode** using the toggle in the top-right corner.
4.  Click **Load unpacked**.
5.  Select the root folder containing manifest.json.

## 🔑 Permissions Breakdown

The extension relies on minimal required permissions defined in manifest.json:

JSON

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   {    "permissions": [      "storage",      "downloads",      "scripting",      "activeTab"    ],    "host_permissions": [      "https://www.naukri.com/*"    ]  }   `

## 🚀 Tech Stack

- **Extension Framework:** Chrome Extension Manifest V3
- **Languages:** JavaScript (ES6+), HTML5, CSS3
- **APIs Used:**
  - chrome.storage.local
  - chrome.downloads
  - chrome.runtime
  - chrome.scripting

## 📌 Future Enhancements

- \[ \] Multi-tab parallel DOM scanning.
- \[ \] Automatic retry logic for unrendered dynamic elements.
- \[ \] Direct support for additional job platforms (LinkedIn, Indeed).
- \[ \] Validation checking for broken external career page links.

## 👤 Author

**Manash Anand**

_Software Engineer • Python • Java • Chrome Extensions • Automation_
