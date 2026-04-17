import { useState } from 'react';
import { auth, db } from '../services/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useStore } from '../store';
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function AuthOverlay() {
  const { user, setUser } = useStore();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');

  if (user) return null; // Nếu đã đăng nhập thì biến mất

  const handleAuth = async () => {
    try {
      let res;
      if (isRegister) {
        res = await createUserWithEmailAndPassword(auth, email, pass);
        // Khi đăng ký, mặc định là 'patient'
        await setDoc(doc(db, "users", res.user.uid), {
          email: email,
          role: "patient", 
          full_name: "Bệnh nhân mới"
        });
        setUser({ email: email, uid: res.user.uid, role: "patient" });
      } else {
        res = await signInWithEmailAndPassword(auth, email, pass);
        
        // TRA SỔ: Lấy thông tin role từ Firestore
        const userDoc = await getDoc(doc(db, "users", res.user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUser({ 
            email: res.user.email, 
            uid: res.user.uid, 
            role: userData.role // Lấy role từ DB (doctor hoặc patient)
          });
        }
      }
    } catch (err) {
      alert("Lỗi: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          {isRegister ? "Tạo tài khoản MediFlow" : "Chào mừng trở lại"}
        </h2>
        <p className="text-slate-500 mb-6 text-sm">Vui lòng đăng nhập để Agent 1 hỗ trợ bạn tốt nhất.</p>

        <input type="email" placeholder="Email" className="w-full border p-3 rounded-lg mb-3"
          onChange={e => setEmail(e.target.value)} />
        <input type="password" placeholder="Mật khẩu" className="w-full border p-3 rounded-lg mb-6"
          onChange={e => setPass(e.target.value)} />

        <button onClick={handleAuth} className="w-full bg-sky-500 text-white p-3 rounded-lg font-bold hover:bg-sky-600 transition">
          {isRegister ? "Đăng ký ngay" : "Đăng nhập"}
        </button>

        <p className="mt-4 text-center text-sm text-slate-600">
          {isRegister ? "Đã có tài khoản?" : "Chưa có tài khoản?"}
          <button onClick={() => setIsRegister(!isRegister)} className="text-sky-500 ml-1 font-semibold">
            {isRegister ? "Đăng nhập" : "Đăng ký"}
          </button>
        </p>
      </div>
    </div>
  );
}