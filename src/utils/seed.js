import {
  connectDB,
  disconnectDB,
  getApplicationsCollection,
  getPaymentsCollection,
  getTuitionsCollection,
  getUsersCollection,
} from "../config/db.js"
import { env } from "../config/env.js"

const USER_SEEDS = [
  {
    email: "admin@mentorlagbe.com",
    name: "Rahim Ahmed",
    role: "admin",
    plan: "pro",
    phone: "+8801711000001",
    location: "Dhaka, Bangladesh",
    bio: "Platform administrator for MentorLagbe.",
    image: "https://i.pravatar.cc/160?img=12",
    createdAt: "2026-09-01T09:00:00.000Z",
  },
  {
    email: "tutor.math@mentorlagbe.com",
    name: "Mahmudul Hasan",
    role: "tutor",
    plan: "tutor-pro",
    phone: "+8801711000002",
    location: "Chattogram, Bangladesh",
    bio: "Mathematics tutor specialising in HSC algebra and calculus.",
    image: "https://i.pravatar.cc/160?img=33",
    createdAt: "2026-09-03T09:00:00.000Z",
  },
  {
    email: "tutor.physics@mentorlagbe.com",
    name: "Nadia Rahman",
    role: "tutor",
    plan: "tutor-pro",
    phone: "+8801711000003",
    location: "Dhaka, Bangladesh",
    bio: "Physics mentor helping students build strong concepts.",
    image: "https://i.pravatar.cc/160?img=47",
    createdAt: "2026-09-04T09:00:00.000Z",
  },
  {
    email: "tutor.code@mentorlagbe.com",
    name: "Tanvir Ahmed",
    role: "tutor",
    plan: "tutor-pro",
    phone: "+8801711000004",
    location: "Sylhet, Bangladesh",
    bio: "Software engineer teaching Python and modern web development.",
    image: "https://i.pravatar.cc/160?img=15",
    createdAt: "2026-09-05T09:00:00.000Z",
  },
  {
    email: "tutor.ielts@mentorlagbe.com",
    name: "Sadia Islam",
    role: "tutor",
    plan: "tutor-pro",
    phone: "+8801711000005",
    location: "Dhaka, Bangladesh",
    bio: "IELTS examiner-style coach for writing and speaking.",
    image: "https://i.pravatar.cc/160?img=45",
    createdAt: "2026-09-06T09:00:00.000Z",
  },
  {
    email: "tutor.chemistry@mentorlagbe.com",
    name: "Karim Sheikh",
    role: "tutor",
    plan: "tutor-pro",
    phone: "+8801711000006",
    location: "Khulna, Bangladesh",
    bio: "Chemistry tutor with a focus on practical exam technique.",
    image: "https://i.pravatar.cc/160?img=52",
    createdAt: "2026-09-07T09:00:00.000Z",
  },
  {
    email: "tutor.english@mentorlagbe.com",
    name: "Farzana Choudhury",
    role: "tutor",
    plan: "free",
    phone: "+8801711000007",
    location: "Rajshahi, Bangladesh",
    bio: "English literature and communication skills tutor.",
    image: "https://i.pravatar.cc/160?img=49",
    createdAt: "2026-09-08T09:00:00.000Z",
  },
  {
    email: "student.anika@mentorlagbe.com",
    name: "Anika Tabassum",
    role: "student",
    plan: "student-pro",
    phone: "+8801811000001",
    location: "Dhaka, Bangladesh",
    bio: "HSC science student preparing for university entrance.",
    image: "https://i.pravatar.cc/160?img=32",
    createdAt: "2026-09-12T09:00:00.000Z",
  },
  {
    email: "student.fahim@mentorlagbe.com",
    name: "Fahim Faisal",
    role: "student",
    plan: "free",
    phone: "+8801811000002",
    location: "Chattogram, Bangladesh",
    bio: "Computer science student learning programming fundamentals.",
    image: "https://i.pravatar.cc/160?img=13",
    createdAt: "2026-09-13T09:00:00.000Z",
  },
  {
    email: "student.nusrat@mentorlagbe.com",
    name: "Nusrat Jahan",
    role: "student",
    plan: "free",
    phone: "+8801811000003",
    location: "Dhaka, Bangladesh",
    bio: "IELTS candidate aiming for an overall band score of 7.5.",
    image: "https://i.pravatar.cc/160?img=44",
    createdAt: "2026-09-14T09:00:00.000Z",
  },
  {
    email: "student.rakib@mentorlagbe.com",
    name: "Rakibul Islam",
    role: "student",
    plan: "free",
    phone: "+8801811000004",
    location: "Sylhet, Bangladesh",
    bio: "Engineering aspirant strengthening physics and chemistry.",
    image: "https://i.pravatar.cc/160?img=11",
    createdAt: "2026-09-15T09:00:00.000Z",
  },
  {
    email: "student.jannat@mentorlagbe.com",
    name: "Jannatul Ferdous",
    role: "student",
    plan: "free",
    phone: "+8801811000005",
    location: "Khulna, Bangladesh",
    bio: "Undergraduate student improving academic English.",
    image: "https://i.pravatar.cc/160?img=41",
    createdAt: "2026-09-16T09:00:00.000Z",
  },
]

const TUITION_SEEDS = [
  {
    seedKey: "math-algebra-foundations",
    tutorEmail: "tutor.math@mentorlagbe.com",
    title: "Algebra Foundations for HSC",
    subject: "Math",
    classLevel: "HSC / Grade 11-12",
    mode: "Online",
    location: "Online — Bangladesh",
    monthlyFee: 2500,
    daysPerWeek: 3,
    bannerImage: "https://images.unsplash.com/photo-1509062522246-3755977927d7",
    description:
      "Master polynomials, equations, functions, and inequalities with weekly problem-solving drills.",
    approvalStatus: "approved",
    isActive: true,
    createdAt: "2026-10-02T10:00:00.000Z",
  },
  {
    seedKey: "math-calculus-essentials",
    tutorEmail: "tutor.math@mentorlagbe.com",
    title: "Calculus Essentials for University",
    subject: "Math",
    classLevel: "University / A-Level",
    mode: "Online",
    location: "Online — Bangladesh",
    monthlyFee: 3200,
    daysPerWeek: 2,
    bannerImage: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb",
    description:
      "Limits, differentiation, and integration explained through applied engineering examples.",
    approvalStatus: "approved",
    isActive: true,
    createdAt: "2026-10-03T10:00:00.000Z",
  },
  {
    seedKey: "physics-mechanics-mastery",
    tutorEmail: "tutor.physics@mentorlagbe.com",
    title: "Mechanics Mastery: Motion to Momentum",
    subject: "Physics",
    classLevel: "HSC / Grade 11-12",
    mode: "Online",
    location: "Online — Bangladesh",
    monthlyFee: 2800,
    daysPerWeek: 3,
    bannerImage: "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa",
    description:
      "Build exam confidence in kinematics, Newton's laws, work, energy, and collisions.",
    approvalStatus: "approved",
    isActive: true,
    createdAt: "2026-10-04T10:00:00.000Z",
  },
  {
    seedKey: "physics-electricity-magnetism",
    tutorEmail: "tutor.physics@mentorlagbe.com",
    title: "Electricity & Magnetism Crash Course",
    subject: "Physics",
    classLevel: "HSC / Grade 12",
    mode: "Offline",
    location: "Dhaka, Bangladesh",
    monthlyFee: 3500,
    daysPerWeek: 2,
    bannerImage: "https://images.unsplash.com/photo-1518770660439-4636190af475",
    description:
      "Circuit analysis, electromagnetism, and induction with guided practical sessions.",
    approvalStatus: "approved",
    isActive: true,
    createdAt: "2026-10-05T10:00:00.000Z",
  },
  {
    seedKey: "programming-python-bootcamp",
    tutorEmail: "tutor.code@mentorlagbe.com",
    title: "Python Programming Bootcamp",
    subject: "Programming",
    classLevel: "Beginner to Intermediate",
    mode: "Online",
    location: "Online — Global",
    monthlyFee: 4000,
    daysPerWeek: 4,
    bannerImage: "https://images.unsplash.com/photo-1526379095098-d400fd0bf935",
    description:
      "Learn Python syntax, data structures, APIs, and automation through hands-on projects.",
    approvalStatus: "approved",
    isActive: true,
    createdAt: "2026-10-06T10:00:00.000Z",
  },
  {
    seedKey: "programming-nextjs-web",
    tutorEmail: "tutor.code@mentorlagbe.com",
    title: "Full-Stack Web Development with Next.js",
    subject: "Programming",
    classLevel: "Intermediate",
    mode: "Online",
    location: "Online — Global",
    monthlyFee: 5500,
    daysPerWeek: 3,
    bannerImage: "https://images.unsplash.com/photo-1498050108023-c5249f4df085",
    description:
      "Build and deploy production-ready apps with React, Next.js, TypeScript, and MongoDB.",
    approvalStatus: "approved",
    isActive: true,
    createdAt: "2026-10-07T10:00:00.000Z",
  },
  {
    seedKey: "ielts-academic-writing",
    tutorEmail: "tutor.ielts@mentorlagbe.com",
    title: "IELTS Academic Writing 7+",
    subject: "IELTS",
    classLevel: "Academic Module",
    mode: "Online",
    location: "Online — Global",
    monthlyFee: 3000,
    daysPerWeek: 3,
    bannerImage: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8",
    description:
      "Task 1 and Task 2 writing strategies with detailed feedback on every submission.",
    approvalStatus: "approved",
    isActive: true,
    createdAt: "2026-10-08T10:00:00.000Z",
  },
  {
    seedKey: "ielts-speaking-masterclass",
    tutorEmail: "tutor.ielts@mentorlagbe.com",
    title: "IELTS Speaking Masterclass",
    subject: "IELTS",
    classLevel: "Academic & General",
    mode: "Online",
    location: "Online — Global",
    monthlyFee: 2600,
    daysPerWeek: 2,
    bannerImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3",
    description:
      "Weekly mock interviews, pronunciation coaching, and band-descriptor feedback.",
    approvalStatus: "approved",
    isActive: true,
    createdAt: "2026-10-09T10:00:00.000Z",
  },
  {
    seedKey: "chemistry-organic-essentials",
    tutorEmail: "tutor.chemistry@mentorlagbe.com",
    title: "Organic Chemistry Essentials",
    subject: "Chemistry",
    classLevel: "HSC / Grade 12",
    mode: "Online",
    location: "Online — Bangladesh",
    monthlyFee: 2900,
    daysPerWeek: 3,
    bannerImage: "https://images.unsplash.com/photo-1532094349884-543bc11b234d",
    description:
      "Reaction mechanisms, functional groups, and synthesis routes made easy to revise.",
    approvalStatus: "approved",
    isActive: true,
    createdAt: "2026-10-10T10:00:00.000Z",
  },
  {
    seedKey: "chemistry-physical-hsc",
    tutorEmail: "tutor.chemistry@mentorlagbe.com",
    title: "Physical Chemistry for HSC",
    subject: "Chemistry",
    classLevel: "HSC / Grade 11-12",
    mode: "Offline",
    location: "Khulna, Bangladesh",
    monthlyFee: 2700,
    daysPerWeek: 2,
    bannerImage: "https://images.unsplash.com/photo-1554475901-4538ddfbccc2",
    description:
      "Mole concept, thermodynamics, and chemical equilibrium with past-paper practice.",
    approvalStatus: "approved",
    isActive: true,
    createdAt: "2026-10-11T10:00:00.000Z",
  },
  {
    seedKey: "english-grammar-composition",
    tutorEmail: "tutor.english@mentorlagbe.com",
    title: "English Grammar & Composition",
    subject: "English",
    classLevel: "Grade 9-12",
    mode: "Online",
    location: "Online — Bangladesh",
    monthlyFee: 2200,
    daysPerWeek: 3,
    bannerImage: "https://images.unsplash.com/photo-1455390582262-044cdead277a",
    description:
      "Fix common grammar errors and write clear essays, letters, and summaries.",
    approvalStatus: "approved",
    isActive: true,
    createdAt: "2026-10-12T10:00:00.000Z",
  },
  {
    seedKey: "english-spoken-professional",
    tutorEmail: "tutor.english@mentorlagbe.com",
    title: "Spoken English for Professionals",
    subject: "English",
    classLevel: "Adult Learners",
    mode: "Online",
    location: "Online — Global",
    monthlyFee: 3200,
    daysPerWeek: 2,
    bannerImage: "https://images.unsplash.com/photo-1521737711867-e3b97375f902",
    description:
      "Meetings, presentations, and everyday conversation practice with a supportive tutor.",
    approvalStatus: "approved",
    isActive: true,
    createdAt: "2026-10-13T10:00:00.000Z",
  },
  {
    seedKey: "math-statistics-intro",
    tutorEmail: "tutor.math@mentorlagbe.com",
    title: "Introductory Statistics for Data Science",
    subject: "Math",
    classLevel: "University / Beginner",
    mode: "Online",
    location: "Online — Global",
    monthlyFee: 3400,
    daysPerWeek: 2,
    bannerImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71",
    description:
      "Probability, distributions, and hypothesis testing with practical Python examples.",
    approvalStatus: "pending",
    isActive: true,
    createdAt: "2026-11-18T10:00:00.000Z",
  },
  {
    seedKey: "programming-data-structures",
    tutorEmail: "tutor.code@mentorlagbe.com",
    title: "Data Structures & Algorithms Fundamentals",
    subject: "Programming",
    classLevel: "Intermediate",
    mode: "Online",
    location: "Online — Global",
    monthlyFee: 4500,
    daysPerWeek: 3,
    bannerImage: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4",
    description:
      "Arrays, trees, graphs, and complexity analysis for coding interviews.",
    approvalStatus: "pending",
    isActive: true,
    createdAt: "2026-11-19T10:00:00.000Z",
  },
  {
    seedKey: "physics-astrophysics-basics",
    tutorEmail: "tutor.physics@mentorlagbe.com",
    title: "Astrophysics for Curious Minds",
    subject: "Physics",
    classLevel: "Grade 10-12",
    mode: "Online",
    location: "Online — Global",
    monthlyFee: 2400,
    daysPerWeek: 1,
    bannerImage: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564",
    description: "A gentle introduction to stars, galaxies, and modern cosmology.",
    approvalStatus: "rejected",
    isActive: false,
    createdAt: "2026-11-10T10:00:00.000Z",
  },
]

const APPLICATION_SEEDS = [
  {
    seedKey: "application-anika-algebra",
    studentEmail: "student.anika@mentorlagbe.com",
    tuitionKey: "math-algebra-foundations",
    status: "accepted",
    studentPhone: "+8801811000001",
    preferredSchedule: "Weekday evenings",
    studentNote: "I struggle with quadratic equations and need regular practice.",
    createdAt: "2026-10-14T10:00:00.000Z",
  },
  {
    seedKey: "application-fahim-python",
    studentEmail: "student.fahim@mentorlagbe.com",
    tuitionKey: "programming-python-bootcamp",
    status: "pending",
    studentPhone: "+8801811000002",
    preferredSchedule: "Weekend mornings",
    studentNote: "Complete beginner, eager to build a first portfolio project.",
    createdAt: "2026-11-15T10:00:00.000Z",
  },
  {
    seedKey: "application-nusrat-ielts-writing",
    studentEmail: "student.nusrat@mentorlagbe.com",
    tuitionKey: "ielts-academic-writing",
    status: "accepted",
    studentPhone: "+8801811000003",
    preferredSchedule: "Tuesday and Thursday evenings",
    studentNote: "My current writing band is 6.0; aiming for 7.5.",
    createdAt: "2026-10-18T10:00:00.000Z",
  },
  {
    seedKey: "application-rakib-mechanics",
    studentEmail: "student.rakib@mentorlagbe.com",
    tuitionKey: "physics-mechanics-mastery",
    status: "pending",
    studentPhone: "+8801811000004",
    preferredSchedule: "Friday afternoons",
    studentNote: "Need extra support with momentum and energy questions.",
    createdAt: "2026-11-16T10:00:00.000Z",
  },
  {
    seedKey: "application-jannat-english",
    studentEmail: "student.jannat@mentorlagbe.com",
    tuitionKey: "english-grammar-composition",
    status: "rejected",
    studentPhone: "+8801811000005",
    preferredSchedule: "Monday evenings",
    studentNote: "Looking for help with essay structure.",
    createdAt: "2026-10-20T10:00:00.000Z",
  },
  {
    seedKey: "application-fahim-nextjs",
    studentEmail: "student.fahim@mentorlagbe.com",
    tuitionKey: "programming-nextjs-web",
    status: "pending",
    studentPhone: "+8801811000002",
    preferredSchedule: "Weekend afternoons",
    studentNote: "I have basic React experience and want to learn full-stack apps.",
    createdAt: "2026-11-17T10:00:00.000Z",
  },
]

const PAYMENT_SEEDS = [
  {
    seedKey: "payment-anika-student-pro",
    userEmail: "student.anika@mentorlagbe.com",
    plan: "student-pro",
    amount: 10,
    currency: "USD",
    status: "completed",
    stripeSessionId: "cs_seed_anika_student_pro",
    stripePaymentIntentId: "pi_seed_anika_student_pro",
    createdAt: "2026-10-08T12:00:00.000Z",
  },
  {
    seedKey: "payment-nusrat-student-pro",
    userEmail: "student.nusrat@mentorlagbe.com",
    plan: "student-pro",
    amount: 10,
    currency: "USD",
    status: "completed",
    stripeSessionId: "cs_seed_nusrat_student_pro",
    stripePaymentIntentId: "pi_seed_nusrat_student_pro",
    createdAt: "2026-10-17T12:00:00.000Z",
  },
  {
    seedKey: "payment-math-tutor-pro",
    userEmail: "tutor.math@mentorlagbe.com",
    plan: "tutor-pro",
    amount: 15,
    currency: "USD",
    status: "completed",
    stripeSessionId: "cs_seed_math_tutor_pro",
    stripePaymentIntentId: "pi_seed_math_tutor_pro",
    createdAt: "2026-10-01T12:00:00.000Z",
  },
  {
    seedKey: "payment-physics-tutor-pro",
    userEmail: "tutor.physics@mentorlagbe.com",
    plan: "tutor-pro",
    amount: 15,
    currency: "USD",
    status: "completed",
    stripeSessionId: "cs_seed_physics_tutor_pro",
    stripePaymentIntentId: "pi_seed_physics_tutor_pro",
    createdAt: "2026-10-02T12:00:00.000Z",
  },
  {
    seedKey: "payment-code-tutor-pro",
    userEmail: "tutor.code@mentorlagbe.com",
    plan: "tutor-pro",
    amount: 15,
    currency: "USD",
    status: "completed",
    stripeSessionId: "cs_seed_code_tutor_pro",
    stripePaymentIntentId: "pi_seed_code_tutor_pro",
    createdAt: "2026-10-03T12:00:00.000Z",
  },
  {
    seedKey: "payment-fahim-student-pending",
    userEmail: "student.fahim@mentorlagbe.com",
    plan: "student-pro",
    amount: 10,
    currency: "USD",
    status: "pending",
    stripeSessionId: "cs_seed_fahim_student_pro",
    stripePaymentIntentId: "",
    createdAt: "2026-11-20T12:00:00.000Z",
  },
]

const inserted = { users: 0, tuitions: 0, applications: 0, payments: 0 }

function iso(value) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

async function upsert(collection, filter, document, kind) {
  const result = await collection.updateOne(
    filter,
    { $setOnInsert: document },
    { upsert: true }
  )
  if (result.upsertedCount === 1) inserted[kind] += 1
}

async function seedUsers() {
  const users = getUsersCollection()
  const byEmail = new Map()

  for (const seed of USER_SEEDS) {
    const timestamp = iso(seed.createdAt)
    await upsert(
      users,
      { email: seed.email },
      {
        ...seed,
        emailVerified: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      "users"
    )
    byEmail.set(seed.email, await users.findOne({ email: seed.email }))
  }

  return byEmail
}

async function seedTuitions(usersByEmail) {
  const tuitions = getTuitionsCollection()
  const byKey = new Map()

  for (const seed of TUITION_SEEDS) {
    const timestamp = iso(seed.createdAt)
    const tutor = usersByEmail.get(seed.tutorEmail)

    await upsert(
      tuitions,
      { seedKey: seed.seedKey },
      {
        ...seed,
        tutorId: tutor ? String(tutor._id) : "",
        tutorName: tutor?.name || "MentorLagbe tutor",
        tutorEmail: seed.tutorEmail,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      "tuitions"
    )
    byKey.set(seed.seedKey, await tuitions.findOne({ seedKey: seed.seedKey }))
  }

  return byKey
}

async function seedApplications(usersByEmail, tuitionsByKey) {
  const applications = getApplicationsCollection()

  for (const seed of APPLICATION_SEEDS) {
    const timestamp = iso(seed.createdAt)
    const student = usersByEmail.get(seed.studentEmail)
    const tuition = tuitionsByKey.get(seed.tuitionKey)
    if (!student || !tuition) continue

    await upsert(
      applications,
      { seedKey: seed.seedKey },
      {
        ...seed,
        tuitionId: String(tuition._id),
        tuitionTitle: tuition.title,
        subject: tuition.subject,
        monthlyFee: tuition.monthlyFee,
        studentId: String(student._id),
        studentName: student.name,
        studentEmail: student.email,
        tutorId: tuition.tutorId,
        tutorName: tuition.tutorName,
        tutorEmail: tuition.tutorEmail,
        appliedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      "applications"
    )
  }
}

async function seedPayments(usersByEmail) {
  const payments = getPaymentsCollection()

  for (const seed of PAYMENT_SEEDS) {
    const timestamp = iso(seed.createdAt)
    const user = usersByEmail.get(seed.userEmail)
    if (!user) continue

    await upsert(
      payments,
      { seedKey: seed.seedKey },
      {
        ...seed,
        userId: String(user._id),
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      "payments"
    )
  }
}

async function main() {
  if (!env.mongodbUri) {
    throw new Error("MONGODB_URI is empty. Add it to .env before running npm run seed.")
  }

  await connectDB()
  try {
    const usersByEmail = await seedUsers()
    const tuitionsByKey = await seedTuitions(usersByEmail)
    await seedApplications(usersByEmail, tuitionsByKey)
    await seedPayments(usersByEmail)
  } finally {
    await disconnectDB()
  }
}

main()
  .then(() => {
    console.log(
      `[seed] Complete — inserted ${inserted.users} users, ${inserted.tuitions} tuitions, ` +
        `${inserted.applications} applications, ${inserted.payments} payments ` +
        "(existing records were kept)."
    )
  })
  .catch((error) => {
    console.error(`[seed] Failed: ${error.message}`)
    process.exitCode = 1
  })
