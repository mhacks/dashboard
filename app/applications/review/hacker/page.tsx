import { Mail } from "./components/mail"
import { accounts, mails } from "./data"

export default function ReviewPage() {
  return (
    <div className="flex h-screen flex-col md:flex">
      <Mail
        accounts={accounts}
        mails={mails}
        defaultLayout={[20, 35, 45]}
        navCollapsedSize={4}
      />
    </div>
  )
}
