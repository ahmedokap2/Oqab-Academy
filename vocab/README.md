# Oqab Vocabulary — Complete Level B, Units 1–15

Created by Mr. Ahmed Oqab

- WhatsApp Saudi Arabia: +966 59 984 0950 — https://wa.me/966599840950
- WhatsApp Egypt: +20 11 5434 8709 — https://wa.me/201154348709

## Contents

The complete course contains 300 words: 20 words in each of Units 1–15. Each word includes its relevant meanings, part of speech, example, synonyms, antonyms, a large responsive visual cue, common phrase, usage note, three context sentences, and pronunciation. Units 1–5 retain their original American Cambridge Dictionary MP3 links. Units 6–15 now use the same Cambridge media host and path convention first. The 30 legacy Cambridge filenames that do not follow that convention are documented centrally in `CAMBRIDGE_IRREGULAR_AUDIO_PATHS`. If a Cambridge recording is temporarily unavailable, the app looks up another natural dictionary recording online; it never substitutes the device's robotic speech voice.

Activities include Study Deeply, Flashcards, Word–Meaning Match, two clue-based Word Search sections, three Context Challenges, three Homework Quizzes, review practice, progress history, and downloadable reports.

## Access and saving

When the teacher selects restricted access, the app requires first name, last name, the student's approved Student ID, and a password. No student email is required. Class and section remain profile data in Firestore and are never used alone to recover a password.

Every new account receives a one-time temporary password. At first login, the student must replace it with a private password of at least 10 characters containing uppercase, lowercase, a number, and a symbol. The student can later change it from the course navigation. If the password is forgotten, the student asks the teacher for a secure reset. Firebase invalidates the old password and creates a new temporary password, which the student must replace at the next login. Teachers can never read or retrieve an existing password.

An approved student remains signed in on the same device through Firebase Authentication and returns automatically. Students should use **Sign out** on a shared device. Practice progress is stored locally and synced to a UID-owned Firestore document. Practice XP is motivational and is not treated as a formal grade.

The teacher dashboard uses temporary in-memory authentication. Closing or leaving the dashboard ends the teacher session. Passwords are managed by Firebase Authentication and are not stored in the website files.

## Deployment and size

The public website remains a small static HTML, CSS, and JavaScript project. Secure account creation, visit recording, and formal assignment grading use Cloud Functions and therefore require the Firebase Blaze plan. The vocabulary interface can still be opened as a multi-file HTML project in OneCompiler, but database, login, visit-counter, and grading features require the deployed Firebase site.

## Verification

Automated checks confirm 300 vocabulary rows, 900 context sentences, 300 pronunciation entries, 20 words per unit, valid distractors, and natural-audio behavior. Firestore rules tests cover public reads, UID ownership, teacher-only answer keys, read-only released grades, and denial of fabricated grades. Run them with Java 21 and the Firebase emulator before production deployment.
