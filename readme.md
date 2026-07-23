# 🚀 Naukri Company Site Scanner

A Manifest V3 Chrome Extension that automates extracting **official company career page URLs** from Naukri job listings, tracks application statuses, caches scan results to minimize redundant requests, and exports actionable job data to CSV.

---

## ✨ Features

- 🔍 **Automated Page Scanning** – Scans active Naukri search result pages and job cards in real time.
- 🌐 **Direct URL Extraction** – Captures direct external company career/ATS links (Workday, Greenhouse, Lever, etc.).
- 💾 **Local Caching** – Stores scan results using `chrome.storage.local` to prevent duplicate scanning.
- 📋 **Application Tracking** – Differentiates between applied and pending opportunities.
- 📤 **CSV Export** – Generate customized CSV reports (Pending Jobs or Complete Job Audit).
- 🗑️ **Cache & State Management** – Clear cached job records and reset live progress counters on demand.
- 📊 **Real-time Stats** – View cached listings, company-apply counts, and last scan timestamps directly from the popup UI.

---

# 🏗️ Architecture Overview

```text
                    +----------------------+
                    |      popup.html      |
                    |    (Extension UI)    |
                    +----------+-----------+
                               |
                               | User Triggers
                               v
                    +----------------------+
                    |       popup.js       |
                    |  UI Event Handlers   |
                    +----------+-----------+
                               |
                   chrome.runtime.sendMessage()
                               |
                               v
          +-----------------------------------+
          |           background.js           |
          |   (MV3 Service Worker Controller) |
          +-----------------------------------+
             |               |               |
             |               |               |
             v               v               v
   +----------------+ +---------------+ +----------------+
   | Chrome Storage | |  Active Tab   | | Downloads API  |
   | Cache & Stats  | | Content Script| | CSV Generation |
   +-------+--------+ +-------+-------+ +----------------+
           |                  |
           |                  v
           |        +-------------------+
           |        |     script.js     |
           |        |  (Content Script) |
           +------->|  DOM Extraction   |
      Stores Cache  +-------------------+
```

---

# 📁 Project Structure

```text
.
├── manifest.json       # Manifest V3 extension configuration
├── popup.html          # Extension popup UI
├── popup.js            # UI logic and event handlers
├── popup.css           # Popup styling
├── background.js       # Service worker and central controller
├── script.js           # Content script for DOM extraction
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

# ⚙️ Component Responsibilities

## popup.js (UI Layer)

Responsible for all popup interactions.

- Handles Scan, Download CSV, Clear Cache, and Force Scan actions.
- Sends runtime messages to the service worker.
- Displays scan statistics and cache information.
- Receives live progress updates during scanning.

---

## background.js (Service Worker)

Acts as the application's central controller.

- Handles runtime messages.
- Maintains extension state.
- Reads/writes data from `chrome.storage.local`.
- Generates downloadable CSV files.
- Coordinates communication between popup and content script.

---

## script.js (Content Script)

Runs inside Naukri pages.

- Parses job cards.
- Extracts official company career page URLs.
- Detects ATS providers (Workday, Greenhouse, Lever, etc.).
- Sends extracted data back to the service worker.

---

# 🔄 Core Workflows

## Scan Flow

```text
User clicks "Scan Current Tab"
            │
            ▼
popup.js sends runtime message
            │
            ▼
background.js starts scan
            │
            ▼
script.js parses Naukri DOM
            │
            ▼
Extract Company Career URLs
            │
            ▼
background.js updates cache
            │
            ▼
popup.js receives progress updates
            │
            ▼
UI refreshes statistics
```

---

## CSV Export Flow

```text
User selects Download (Pending / All)
            │
            ▼
popup.js sends export request
            │
            ▼
background.js loads cached jobs
            │
            ▼
Filters Pending / All
            │
            ▼
Builds CSV
            │
            ▼
chrome.downloads.download()
            │
            ▼
CSV saved locally
```

---

# 📦 Installation

Clone the repository.

```bash
git clone https://github.com/your-username/naukri-company-site-scanner.git
```

Open Chrome and navigate to:

```
chrome://extensions
```

Then:

1. Enable **Developer Mode**.
2. Click **Load unpacked**.
3. Select the project folder containing `manifest.json`.

---

# 🔑 Required Permissions

```json
{
  "permissions": ["storage", "downloads", "scripting", "activeTab"],
  "host_permissions": ["https://www.naukri.com/*"]
}
```

### Why These Permissions?

| Permission         | Purpose                                 |
| ------------------ | --------------------------------------- |
| `storage`          | Cache scanned jobs and application data |
| `downloads`        | Export CSV reports                      |
| `activeTab`        | Access the currently opened Naukri page |
| `scripting`        | Execute the content script on demand    |
| `host_permissions` | Restrict execution to Naukri pages      |

---

# 🚀 Tech Stack

### Chrome Extension

- Manifest V3
- Service Worker Architecture

### Languages

- JavaScript (ES6+)
- HTML5
- CSS3

### Chrome APIs

- `chrome.runtime`
- `chrome.storage.local`
- `chrome.scripting`
- `chrome.downloads`

---

# 📊 Data Flow

```text
          User
            │
            ▼
      popup.html
            │
            ▼
        popup.js
            │
            ▼
      background.js
        │         │
        │         ▼
        │    chrome.storage.local
        │
        ▼
     script.js
        │
        ▼
   Naukri Job Cards
        │
        ▼
 Extract Career URLs
        │
        ▼
background.js
        │
        ▼
 popup.js UI Update
```

---

# 🎯 Future Enhancements

- [ ] Multi-tab parallel scanning
- [ ] Automatic retry for dynamically loaded job cards
- [ ] Support for LinkedIn Jobs
- [ ] Support for Indeed
- [ ] Broken company career page detection
- [ ] Duplicate company detection
- [ ] Scan history and analytics dashboard

---

# 👤 Author

**Manash Anand**

Software Engineer • Python • Java • Chrome Extensions • Automation

---

## ⭐ If you found this project useful, consider giving it a star!
