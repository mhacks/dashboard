import { mails } from "./data"
import { Mail } from "./components/mail"

export default function ReviewPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Mail mails={mails} />
    </div>
  )
}
