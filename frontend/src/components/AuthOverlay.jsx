import { useState } from 'react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'

import { auth, db } from '../services/firebase'
import { savePatientProfile } from '../services/api'
import { useStore } from '../store'

export default function AuthOverlay() {
  const { user, setUser } = useStore()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')

  if (user) return null

  const handleAuth = async () => {
    try {
      let res
      if (isRegister) {
        const fullName = 'Bệnh nhân mới'
        res = await createUserWithEmailAndPassword(auth, email, pass)
        await setDoc(doc(db, 'users', res.user.uid), {
          email,
          role: 'patient',
          full_name: fullName,
        })
        try {
          await savePatientProfile({
            uid: res.user.uid,
            name: fullName,
            phone: '',
            email,
            role: 'patient',
          })
        } catch (_) {
          // Keep auth flow working if profile sync is temporarily unavailable.
        }
        setUser({ email, uid: res.user.uid, role: 'patient', full_name: fullName })
      } else {
        res = await signInWithEmailAndPassword(auth, email, pass)
        const userDoc = await getDoc(doc(db, 'users', res.user.uid))
        if (userDoc.exists()) {
          const userData = userDoc.data()
          setUser({
            email: res.user.email,
            uid: res.user.uid,
            role: userData.role,
            full_name: userData.full_name || res.user.email,
          })
        }
      }
    } catch (err) {
      alert(`Lỗi: ${err.message}`)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          {isRegister ? 'Tạo tài khoản MediFlow' : 'Chào mừng trở lại'}
        </h2>
        <p className="text-slate-500 mb-6 text-sm">Vui lòng đăng nhập để Agent 1 hỗ trợ bạn tốt nhất.</p>

        <input
          type="email"
          placeholder="Email"
          className="w-full border p-3 rounded-lg mb-3"
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Mật khẩu"
          className="w-full border p-3 rounded-lg mb-6"
          onChange={(e) => setPass(e.target.value)}
        />

        <button onClick={handleAuth} className="w-full bg-sky-500 text-white p-3 rounded-lg font-bold hover:bg-sky-600 transition">
          {isRegister ? 'Đăng ký ngay' : 'Đăng nhập'}
        </button>

        <p className="mt-4 text-center text-sm text-slate-600">
          {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
          <button onClick={() => setIsRegister(!isRegister)} className="text-sky-500 ml-1 font-semibold">
            {isRegister ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        </p>
      </div>
    </div>
  )
}
