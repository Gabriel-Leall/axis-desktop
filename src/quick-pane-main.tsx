import ReactDOM from 'react-dom/client'
import './i18n'
import QuickPaneApp from './components/quick-pane/QuickPaneApp'
import './quick-pane.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <QuickPaneApp />
)
