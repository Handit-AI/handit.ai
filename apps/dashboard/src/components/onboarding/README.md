# 🎯 JSON-Driven Onboarding System

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-2.0.0-green.svg)
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)
![Status](https://img.shields.io/badge/status-production--ready-success.svg)

*A comprehensive, JSON-configurable onboarding system that orchestrates seamless user experiences*

[🚀 Quick Start](#-quick-start) • [🎮 Demo](https://www.linkedin.com/posts/joseramirezr17_i-honestly-have-never-seen-an-onboarding-activity-7349466757700444161-EHhQ/?utm_source=share&utm_medium=member_desktop&rcm=ACoAACl5PnwBWEKArfkrAIxq34cty7pSyMFA0rc)

</div>

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🚀 Quick Start](#-quick-start)
- [📖 API Reference](#-api-reference)
- [🎨 Configuration](#-configuration)
- [🎮 Components](#-components)
- [💡 Examples](#-examples)
- [📁 Project Structure](#-project-structure)
- [🔧 Advanced Usage](#-advanced-usage)
- [📊 Analytics & Events](#-analytics--events)
- [🎯 Best Practices](#-best-practices)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ Features

<table>
<tr>
<td>

🎯 **JSON-Driven Configuration**  
Define entire user journeys in declarative JSON

⚡ **Zero-Config Setup**  
Works out of the box with sensible defaults

🎨 **Fully Customizable**  
Theme, content, and behavior adaptation

</td>
<td>

🧠 **Smart Triggers**  
Conditional logic based on user state

📱 **Multi-Modal Experience**  
Tooltips, modals, cursor guidance, banners

📊 **Built-in Analytics**  
Track completion rates and user behavior

</td>
</tr>
</table>

---


<details>
<summary><strong>🔧 Core Components</strong></summary>

| Component | Purpose | Usage |
|-----------|---------|-------|
| `OnboardingOrchestrator` | Main coordinator | Manages entire flow |
| `OnboardingService` | State management | Singleton service |
| `OnboardingMenu` | Navigation popup | Tour selection |
| `OnboardingAssistant` | Floating guide | Step-by-step help |
| `OnboardingBanner` | Contextual tooltips | Positioned hints |
| `OnboardingChat` | Interactive chat interface | Assistant & agent setup |
| `ConnectAgentBanner` | Agent connection guide | Connection workflow |
| `OnboardingChatContainer` | Chat wrapper | Event management |
| `InvisibleMouse` | Cursor guidance | Interactive tutorials |

</details>

---

## 🚀 Quick Start

### Installation

```bash
# The system is already integrated in the dashboard
# No additional installation required
```

### Basic Implementation

```jsx
import { OnboardingOrchestrator } from '@/components/onboarding';

export default function MyPage() {
  const [active, setActive] = useState(false);

  return (
    <>
      <button 
        onClick={() => setActive(true)}
        className="btn-primary"
      >
        🎯 Start Onboarding
      </button>

      {active && (
        <OnboardingOrchestrator
          autoStart={false}
          userState={{
            userId: 'user-123',
            agentType: 'document-ai',
            agentName: 'My Agent'
          }}
          onComplete={(tour) => {
            setActive(false);
            console.log('✅ Completed:', tour);
          }}
          onSkip={(data) => {
            setActive(false);
            console.log('⏭️ Skipped:', data.reason);
          }}
        />
      )}
    </>
  );
}
```

### Auto-Triggered Experience

```jsx
<OnboardingOrchestrator
  autoStart={true}
  triggerOnMount={true}
  userState={{
    loginCount: 1,
    signupCompleted: true,
    agentType: 'custom-agent'
  }}
  onComplete={handleComplete}
  onSkip={handleSkip}
/>
```

---

## 📖 API Reference

<details>
<summary><strong>OnboardingOrchestrator Props</strong></summary>

```typescript
interface OnboardingOrchestratorProps {
  autoStart?: boolean;           // Auto-start when conditions met
  triggerOnMount?: boolean;      // Check triggers on mount
  userState?: UserState;         // User context for personalization
  onComplete?: (tour: Tour) => void;  // Completion callback
  onSkip?: (data: SkipData) => void;  // Skip callback
}
```

</details>

<details>
<summary><strong>OnboardingChat Props</strong></summary>

```typescript
interface OnboardingChatProps {
  mode?: 'assistant' | 'agent-setup';  // Chat mode
  visible?: boolean;                   // Visibility state
  position?: string;                   // Position on screen
  onComplete?: () => void;             // Completion callback
  onClose?: () => void;                // Close callback
  questions?: string[];                // Pre-loaded questions
  isDarkMode?: boolean;                // Theme mode
}
```

</details>

<details>
<summary><strong>ConnectAgentBanner Props</strong></summary>

```typescript
interface ConnectAgentBannerProps {
  visible?: boolean;                      // Show/hide banner
  onClose?: () => void;                   // Close callback
  onConnectionSuccess?: () => void;       // Success callback
  onSkip?: () => void;                    // Skip callback
  chatPosition?: string;                  // Chat position when opened
}
```

</details>

<details>
<summary><strong>OnboardingService Methods</strong></summary>

```javascript
import onboardingService from '@/services/onboarding/onboardingService';

// 🚀 Initialize with user data
onboardingService.init({ 
  userId: '123', 
  agentType: 'document-ai' 
});

// 🎯 Start specific tour
onboardingService.startTour('welcome-concept-walkthrough');

// 📝 Handle form submissions
onboardingService.submitForm('agent-type-selection', formData);

// 📊 Track custom events
onboardingService.trackEvent('custom_event', { data: 'value' });
```

</details>

---

## 🎨 Configuration

### JSON Structure Overview

```json
{
  "tourConfig": {
    "triggers": {
      "firstLogin": {
        "condition": "user.loginCount === 1",
        "tourId": "welcome-concept-walkthrough"
      }
    },
    "tours": [
      {
        "id": "welcome-concept-walkthrough",
        "name": "🎉 Welcome Tour",
        "type": "modal",
        "steps": [...]
      }
    ]
  }
}
```

<details>
<summary><strong>📝 Step Types</strong></summary>

| Type | Description | Use Case |
|------|-------------|----------|
| `fullscreen-modal` | Full-screen welcome | Onboarding intro |
| `modal` | Dialog forms | Data collection |
| `cursor-only` | Invisible guidance | Interactive tutorials |
| `tooltip` | Positioned help | Feature highlights |

</details>

<details>
<summary><strong>🖱️ Cursor Guidance Example</strong></summary>

```json
{
  "type": "cursor-only",
  "cursorGuidance": {
    "enabled": true,
    "steps": [
      {
        "target": ".nav-text",
        "targetText": "Tracing",
        "action": { "type": "click" },
        "instruction": {
          "title": "📊 Click on Tracing",
          "description": "View all your agent executions here",
          "position": "right"
        }
      }
    ]
  }
}
```

</details>

---

## 🎮 Components

### Standalone Usage

```jsx
import { 
  OnboardingMenu,
  OnboardingAssistant,
  OnboardingChat,
  ConnectAgentBanner,
  OnboardingChatContainer,
  useOnboardingBanners,
  useInvisibleMouse 
} from '@/components/onboarding';

// 🎯 Menu popup
<OnboardingMenu 
  open={true} 
  onClose={handleClose}
  onOnboardingClick={startTour} 
/>

// 🤖 Floating assistant
<OnboardingAssistant
  visible={true}
  currentStep={2}
  totalSteps={5}
  onNext={handleNext}
  onPrevious={handlePrev}
/>

// 💬 Interactive chat interface
<OnboardingChat
  mode="assistant" // or "agent-setup"
  visible={true}
  position="center"
  onComplete={handleChatComplete}
  onClose={handleChatClose}
  questions={['How do I set up my agent?']}
/>

// 🔗 Agent connection banner
<ConnectAgentBanner
  visible={true}
  onConnectionSuccess={handleSuccess}
  onSkip={handleSkip}
  chatPosition="center"
/>

// 📦 Chat container wrapper
<OnboardingChatContainer
  connectionStatus="disconnected"
  onComplete={handleComplete}
  questions={customQuestions}
/>

// 💡 Banner system
const banners = useOnboardingBanners();
banners.showBanner({
  title: '💡 Pro Tip',
  message: 'Use keyboard shortcuts for faster navigation',
  position: { top: 100, left: 200 }
});

// 🖱️ Mouse guidance
const mouse = useInvisibleMouse();
mouse.moveToElement('.my-button');
mouse.clickElement('.my-button');
```

---

## 💡 Examples

<details>
<summary><strong>🏠 Dashboard Integration</strong></summary>

```jsx
export default function DashboardPage() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  return (
    <div className="dashboard">
      <header>
        <button 
          onClick={() => setShowOnboarding(true)}
          className="btn-outline"
        >
          🎯 Get Started
        </button>
      </header>

      {showOnboarding && (
        <OnboardingOrchestrator
          userState={{ agentType: 'document-ai' }}
          onComplete={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}
```

</details>

<details>
<summary><strong>🔐 Auto-trigger on First Login</strong></summary>

```jsx
export default function AppLayout({ user }) {
  return (
    <>
      <Navigation />
      <MainContent />
      
      <OnboardingOrchestrator
        autoStart={true}
        triggerOnMount={true}
        userState={{
          loginCount: user.loginCount,
          signupCompleted: user.signupCompleted,
          agentType: user.preferences?.agentType
        }}
      />
    </>
  );
}
```

</details>

---

## 📁 Project Structure

```
apps/dashboard/src/
├── 📁 components/onboarding/
│   ├── 🎯 OnboardingOrchestrator.js    # Main orchestrator (56KB)
│   ├── 📋 OnboardingMenu.js           # Menu popup (17KB)
│   ├── 🤖 OnboardingAssistant.js      # Floating assistant (8.5KB)
│   ├── 💡 OnboardingBanner.js         # Tooltip banners (12KB)
│   ├── 💬 OnboardingChat.js           # Interactive chat interface (29KB)
│   ├── 🔗 ConnectAgentBanner.js       # Agent connection guide (5.8KB)
│   ├── 📦 OnboardingChatContainer.js  # Chat wrapper (2.9KB)
│   ├── 🖱️ InvisibleMouse.js           # Mouse guidance (9.7KB)
│   ├── 📚 OnboardingFullGuide.js      # Full guide dialogs (24KB)
│   ├── 🏗️ StableBannerContainer.js    # Banner container (1.8KB)
│   ├── 💻 CodeRenderer.js             # Code display utility (643B)
│   ├── 🔌 ConnectionStatusManager.js  # Connection status (908B)
│   └── 📤 index.js                    # Public exports (593B)
├── 📁 services/onboarding/
│   ├── ⚙️ config.json                 # Tour configuration
│   └── 🔧 onboardingService.js        # Service manager
└── 📁 app/(dashboard)/
    ├── 🎮 onboarding-demo/page.js     # Demo page
    └── 📊 ag-monitoring/page.js       # Production example
```

---

## 🔧 Advanced Usage

### 🎨 Agent Type Customization

<details>
<summary><strong>Supported Agent Types</strong></summary>

| Agent Type | Description | Recommended Evaluators |
|------------|-------------|----------------------|
| `document-ai` | Document processing | Completeness, Accuracy |
| `custom-agent` | General assistants | Response Quality, Helpfulness |
| `langchain-rag` | Knowledge base | Relevance, Factuality |

</details>

### 🔄 Dynamic Content System

```json
{
  "dynamicContent": {
    "recommendedEvaluators": {
      "document-ai": {
        "name": "📋 Completeness Evaluator",
        "description": "Ensures all required fields are extracted",
        "icon": "✅"
      }
    }
  }
}
```

### 🏷️ Content Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{user.agentName}}` | User's agent name | "My Document AI" |
| `{{user.agentType}}` | Selected agent type | "document-ai" |
| `{{user.integrationToken}}` | Generated token | "hdt_abc123..." |
| `{{recommendedEvaluator.name}}` | Evaluator name | "Completeness Evaluator" |

---

## 📊 Analytics & Events

### Built-in Event Tracking

```javascript
// 📈 Automatically tracked events
const events = [
  'tour_started',
  'step_completed',
  'tour_completed', 
  'tour_skipped',
  'action_clicked',
  'integration_completed',
  'first_trace_received',
  'evaluator_created'
];

// 📊 Access analytics
console.log(onboardingService.analytics);
```

---

## 🎯 Best Practices

<table>
<tr>
<td>

### ✅ Do's

- 🎯 Start with the orchestrator
- 🎨 Personalize with user state  
- 🧪 Test all flows thoroughly
- 📊 Monitor analytics regularly
- 🔄 Iterate based on data

</td>
<td>

### ❌ Don'ts

- 🚫 Skip user state setup
- 🚫 Overload with too many steps
- 🚫 Ignore completion rates
- 🚫 Hardcode content
- 🚫 Skip mobile testing

</td>
</tr>
</table>

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">

### 🚀 Ready to get started?

**Made with ❤️ for better user experiences**

</div> 