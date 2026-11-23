import { create } from "zustand";
import { Announcement } from "../types/home";

export const initialAnnouncements: Announcement[] = [
  {
    id: "ann-1",
    authorityGroup: "Managing Director's Office (MD)",
    authorityCode: "MD",
    directiveNo: "DIR-2026-08",
    title: "FY2027 Q4 Business Goals and Security Audit Schedule",
    summary:
      "ဒါရိုက်တာဘုတ်အဖွဲ့မှ စတုတ္ထသုံးလပတ် လုပ်ငန်းပန်းတိုင်များကို အတည်ပြုပြီးဖြစ်ပါသည်။ လာမည့်အပတ်တွင် လုံခြုံရေးဆိုင်ရာ စံနှုန်းစစ်ဆေးမှုများ စတင်ပါမည်။",
    fullBody:
      "ဒါရိုက်တာဘုတ်အဖွဲ့မှ FY2027 စတုတ္ထသုံးလပတ် လုပ်ငန်းပန်းတိုင်များနှင့် နည်းပညာအခြေခံအဆောက်အအုံဆိုင်ရာ လမ်းပြမြေပုံများကို တရားဝင်အတည်ပြုလိုက်ပြီ ဖြစ်ပါသည်။\n\nဌာနခွဲအသီးသီးမှ တာဝန်ရှိသူများအနေဖြင့် နိုဝင်ဘာလကုန်တွင် သက်ဆိုင်ရာ လုပ်ငန်းစီမံချက်များကို အပြီးသတ်ညှိနှိုင်းဆောင်ရွက်ကြရန် ညွှန်ကြားအပ်ပါသည်။ လာမည့် ကြာသပတေးနေ့ နံနက် ၁၀:၀၀ နာရီတွင် အရေးကြီးဌာနတွင်း အစည်းအဝေး ကျင်းပပါမည်။",
    date: "Nov 15, 2026",
    issuer: "Dr. Arthur Vance (Senior Executive Director)",
    priority: "Urgent",
    isRead: false,
  },
  {
    id: "ann-2",
    authorityGroup: "Human Resources Department (HR)",
    authorityCode: "HR",
    directiveNo: "DIR-2026-07",
    title: "Annual Leave Transfer and Public Holiday Announcement",
    summary:
      "နိုဝင်ဘာ ၂၆ နှင့် ၂၇ ရက်များတွင် ရုံးပိတ်ပါမည်။ ခွင့်ရက်လက်ကျန် လွှဲပြောင်းလိုသူများ ဒီဇင်ဘာ ၁၅ ရက်မတိုင်မီ စာရင်းတင်ပြရပါမည်။",
    fullBody:
      "လာမည့် နိုဝင်ဘာ ၂၆ နှင့် ၂၇ ရက်တို့တွင် ရုံးချုပ်အား တရားဝင် ပိတ်ထားမည်ဖြစ်ပြီး အရေးပေါ် အင်ဂျင်နီယာအဖွဲ့သာ အလှည့်ကျ တာဝန်ထမ်းဆောင်ပါမည်။\n\nနှစ်ကုန်ခွင့်ရက် လွှဲပြောင်းခွင့်ရှိသူများ (အများဆုံး ၅ ရက်) အနေဖြင့် ဒီဇင်ဘာ ၁၅ ရက်မတိုင်မီ HR Portal မှတစ်ဆင့် လျှောက်ထားအတည်ပြုချက် ရယူကြပါရန် အသိပေးအပ်ပါသည်။",
    date: "Nov 12, 2026",
    issuer: "Human Resources Department (HR)",
    priority: "Standard",
    isRead: true,
  },
  {
    id: "ann-3",
    authorityGroup: "Engineering Department (ENG)",
    authorityCode: "ENG",
    directiveNo: "DIR-2026-06",
    title:
      "စနစ်အဆင့်မြှင့်တင်ခြင်း (Release v4.2) နှင့် ကုဒ်ပိတ်သိမ်းမှု အသိပေးချက်",
    summary:
      "Release v4.2 အတွက် ကုဒ်ပြင်ဆင်မှုများကို ယခုသောကြာနေ့ ညနေ ၆:၀၀ တွင် နောက်ဆုံးထား တင်သွင်းရပါမည်။ စမ်းသပ်မှုများ အပြည့်အစုံ ပြုလုပ်ထားရန် လိုအပ်ပါသည်။",
    fullBody:
      "Release v4.2 စနစ်အဆင့်မြှင့်တင်မှုအတွက် ကုဒ်ပြင်ဆင်ရေးလုပ်ငန်းများကို ယခုသောကြာနေ့ ညနေ ၆:၀၀ တွင် ရပ်ဆိုင်း (Code Freeze) ပြုလုပ်ပါမည်။\n\nQA စစ်ဆေးမှုများနှင့် စမ်းသပ်ချက်များကို အချိန်မီ ပြီးစီးအောင် ဆောင်ရွက်ကြရန်နှင့် အကြီးတန်းဗိသုကာပညာရှင်၏ ခွင့်ပြုချက်မရှိဘဲ အရေးပေါ်ကုဒ်ပြင်ဆင်မှုများ မပြုလုပ်ရန် အထူးသတိပေးအပ်ပါသည်။",
    date: "Nov 10, 2026",
    issuer: "David Thorne (Senior Software Architect)",
    priority: "Standard",
    isRead: true,
  },
];

interface AnnouncementState {
  announcements: Announcement[];
  selectedAnnouncement: Announcement | null;

  setSelectedAnnouncement: (announcement: Announcement | null) => void;
  acknowledgeAnnouncement: (id: string) => void;
}

export const useAnnouncementStore = create<AnnouncementState>((set) => ({
  announcements: initialAnnouncements,
  selectedAnnouncement: null,

  setSelectedAnnouncement: (announcement) => {
    set({ selectedAnnouncement: announcement });
  },

  acknowledgeAnnouncement: (id: string) => {
    set((state) => ({
      announcements: state.announcements.map((item) =>
        item.id === id ? { ...item, isRead: true } : item,
      ),
    }));
  },
}));
