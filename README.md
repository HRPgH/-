# Shiftmate

## 웹 개발

```bash
npm install
npm run dev
```

## 공개 테스트 배포 전 관리자 로그인 설정

GitHub에 코드를 공개하거나 웹앱을 배포하기 전에 Supabase SQL Editor에서 [`supabase/migrations/20261008_secure_admin_login.sql`](./supabase/migrations/20261008_secure_admin_login.sql)을 실행하고 배포해야 합니다. 이 설정은 브라우저에서 관리자 비밀번호를 직접 읽지 못하게 하지만, 앱의 다른 Supabase 테이블 권한까지 모두 보호하는 것은 아닙니다. 실제 데이터가 연결된 공개 배포 전에는 각 테이블의 Row Level Security 정책과 권한도 별도로 검토하세요.

## Android 테스트 앱

Android 앱은 웹 화면을 APK에 포함합니다. 로그인, 명단, 대화 등 Supabase 기능을 사용하려면 휴대폰이 인터넷에 연결되어 있어야 합니다.

1. Windows에 Android Studio를 설치하고 Android SDK를 설정합니다.
2. 프로젝트 의존성을 설치하고 Android 프로젝트를 한 번 생성합니다:

   ```bash
   npm install
   npx cap add android
   ```

3. 앱의 웹 화면을 정적으로 빌드하고 Android 프로젝트에 복사합니다:

   ```bash
   npm run build
   npx cap sync android
   ```

4. Android Studio에서 `android` 폴더를 열고 `Build > Build Bundle(s) / APK(s) > Build APK(s)`를 선택합니다.
5. APK는 `android/app/build/outputs/apk/debug/app-debug.apk`에 생성됩니다. 파일을 Android 휴대폰으로 옮겨 설치할 수 있습니다. 휴대폰 설정에서 이 파일 관리자/브라우저의 앱 설치를 허용해야 할 수 있습니다.

`capacitor.config.ts`의 앱 ID는 `com.ollpum.shiftmate`입니다. 앱 웹 자산은 APK에 포함되므로 웹 서버 주소가 필요하지 않지만, 앱 코드를 바꾸면 다시 빌드해 새 APK를 설치해야 합니다.

개발 서버가 실행 중인 상태에서 `npm run build`를 실행하지 마세요. 두 명령은 같은 `.next` 빌드 캐시를 사용합니다.
