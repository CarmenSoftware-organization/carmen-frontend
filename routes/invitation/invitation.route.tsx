import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ApiError, isTransportError } from "@/lib/api-error";
import { tokenStore } from "@/lib/auth/token-store";
import {
  acceptInvitation,
  acceptInvitationWithSignup,
  declineInvitation,
  getInvitation,
} from "@/lib/invitation-api";
import { AuthFormAlert } from "@/components/auth/floating-field";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Button } from "@/components/ui/button";
import SignupProfileForm from "../register/signup-profile-form";
import type { SignupProfileValues } from "../register/signup-schema";
import InvitationSummary from "./invitation-summary";

/**
 * หน้า `/invitations/:token` — public เพราะคนที่เปิดลิงก์อาจยังไม่มีบัญชี
 *
 * แยก "ลิงก์ตาย" ออกจาก "โหลดไม่สำเร็จ" ด้วย 410 เท่านั้น — เดิมหน้านี้กลืน error ทุกชนิดเป็น
 * "ลิงก์หมดอายุ" ซึ่งบอกผู้ใช้ผิดเมื่อเน็ตหลุดหรือ backend ล่ม และเคยปิดบังบั๊ก path ที่ทำให้ทุก
 * request ได้ 404 ไว้จนไม่มีใครรู้ว่าหน้านี้ไม่เคยทำงาน การแยกไม่ได้เปิดเผยอะไรเพิ่มให้ผู้ถือลิงก์
 * เพราะ backend คืน 410 ใบเดียวครอบทั้ง "ไม่มีจริง / หมดอายุ / ถูกใช้แล้ว" อยู่แล้ว
 *
 * หน้าจอถาม backend ว่าอีเมลของคำเชิญอยู่ในสถานะไหน (`account_state`) เพื่อเสนอทางเข้าทางเดียว
 * ที่ใช้ได้จริง ข้อเท็จจริงนี้ถูกเปิดเผยอยู่แล้วในรูป 409 ตอนกดสร้างบัญชี การถามก่อนจึงไม่ได้จ่ายความลับ
 * เพิ่ม แต่ตัดการกรอกฟอร์มทิ้งออกไป สถานะมีสี่ค่าและแปลเป็นหน้าจอสามแบบ:
 * - `owned` มีเจ้าของแล้ว → เสนอเข้าสู่ระบบอย่างเดียว
 * - `free` / `reclaimable` สมัครได้ (บัญชีที่ยังไม่ยืนยันถูกยึดคืนตอนสมัคร) → เสนอสร้างบัญชี
 * - `conflict` อีเมลไปตรงกับ **ชื่อผู้ใช้** ของบัญชีอื่น → ไม่มีปุ่มใด ๆ เพราะทุกทางตัน เข้าสู่ระบบก็ไม่ได้
 *   (บัญชีที่ชนไม่ใช่ของเขา) สมัครก็ได้ 409 ต้องรอผู้ดูแลแก้ ซึ่ง backend แจ้งผู้ออกคำเชิญให้แล้ว
 * `has_account` ยังอ่านอยู่แต่เป็นทางถอยสำหรับ backend รุ่นก่อนที่ยังไม่มี `account_state` เท่านั้น
 * เมื่อ backend ตอบไม่ได้ (`null` ทั้งคู่) หน้าจอกลับไปเสนอทั้งสองทาง และ backend ยังเป็นผู้ตัดสิน
 * ความจริงเสมอ — กดสร้างบัญชีจากสถานะที่ไม่รู้ยังได้ 409 พร้อมข้อความของ backend เองที่บอกทางออก
 * ที่ถูกของ code นั้น ๆ
 *
 * รับ token ได้ทั้งสองรูปแบบโดยตั้งใจ — `/invitations/<token>` และ `/invitations?token=<token>`
 * เพราะ backend ประกอบลิงก์ด้วย `searchParams.set('token', …)` ต่อท้าย Base URL ที่ผู้ดูแลตั้งไว้
 * จึงได้รูปแบบ query ส่วนรูปแบบ path เป็นสิ่งที่คนอ่านลิงก์แล้วเดาว่าน่าจะเป็น การรับทั้งคู่ทำให้ค่า
 * Base URL ที่ตั้งผิดรูปแบบไม่กลายเป็นลิงก์เสียที่ผู้ถูกเชิญแก้เองไม่ได้
 */
export function Component() {
  const { token: pathToken } = useParams();
  const [searchParams] = useSearchParams();
  const token = pathToken ?? searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const t = useTranslations("auth");
  const [mode, setMode] = useState<"choose" | "signup">("choose");
  const isAuthed = tokenStore.get() !== null;

  const {
    data: invitation,
    error: loadError,
    isPending,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => getInvitation(token),
    // ไม่ตั้ง retry เอง — `makeQueryClient` มีนโยบายกลางอยู่แล้ว (4xx ไม่ลองซ้ำ อย่างอื่นลองหนึ่งครั้ง)
    // ซึ่งเป็นสิ่งที่หน้านี้ต้องการพอดี การเขียนทับจะทำให้มีนโยบายสองชุดที่ต้องแก้ให้ตรงกันตลอดไป
  });

  const signup = useMutation({
    mutationFn: (values: SignupProfileValues) =>
      acceptInvitationWithSignup(token, {
        password: values.password,
        user_info: {
          first_name: values.firstName.trim(),
          last_name: values.lastName.trim(),
          ...(values.telephone.trim()
            ? { telephone: values.telephone.trim() }
            : {}),
        },
      }),
    onSuccess: () =>
      navigate("/login", { replace: true, state: { justRegistered: true } }),
  });

  const accept = useMutation({
    mutationFn: () => acceptInvitation(token),
    onSuccess: () => navigate("/dashboard", { replace: true }),
  });

  const decline = useMutation({
    mutationFn: () => declineInvitation(token),
    onSuccess: () => navigate("/login", { replace: true }),
  });

  if (isPending) {
    return (
      <AuthSplitShell
        title={t("invitation.title")}
        subtitle={t("invitation.loading")}
      >
        <div className="mt-5 flex justify-center">
          <span
            className="border-muted-foreground/30 border-t-muted-foreground inline-block size-6 animate-spin rounded-full border-2"
            role="status"
            aria-label={t("invitation.loading")}
          />
        </div>
      </AuthSplitShell>
    );
  }

  // เช็คว่า "ไม่มีข้อมูลจะแสดง" ไม่ใช่ "มี error" — ถ้าโหลดสำเร็จไปแล้วแล้ว refetch เบื้องหลังล้ม
  // (สลับแท็บกลับมา เน็ตสะดุด) ข้อมูลเดิมยังถูกต้องและยังใช้ได้ การทิ้งมันไปขึ้นหน้า error แทน
  // คือการลงโทษผู้ใช้ด้วยความล้มเหลวที่เขาไม่ได้เห็นและไม่ได้เดือดร้อน
  if (!invitation) {
    // 410 คือคำตอบเดียวที่ backend ใช้บอกว่าลิงก์ใช้ไม่ได้ (ไม่มีจริง หมดอายุ หรือถูกใช้แล้ว)
    // อย่างอื่นทั้งหมดแปลว่าเรายังไม่รู้ว่าลิงก์เป็นยังไง จึงต้องเสนอให้ลองใหม่ ไม่ใช่ประกาศว่ามันตาย
    if (loadError instanceof ApiError && loadError.statusCode === 410) {
      return (
        <AuthSplitShell
          title={t("invitation.deadTitle")}
          subtitle={t("invitation.deadDescription")}
        >
          <Button asChild className="mt-5 h-10 w-full">
            <Link to="/login">{t("signIn")}</Link>
          </Button>
        </AuthSplitShell>
      );
    }

    return (
      <AuthSplitShell
        title={t("invitation.loadFailedTitle")}
        subtitle={t("invitation.loadFailedDescription")}
      >
        <div className="mt-5 flex flex-col gap-2">
          <Button
            className="h-10 w-full"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? t("invitation.loading") : t("invitation.retry")}
          </Button>
          <Button variant="outline" className="h-10 w-full" asChild>
            <Link to="/login">{t("signIn")}</Link>
          </Button>
        </div>
      </AuthSplitShell>
    );
  }

  // ล็อกอินอยู่แล้ว — ไม่ต้องเดาฝั่ง client ว่าเป็นบัญชีที่ถูกคนหรือไม่ backend เทียบอีเมลเองและตอบ 403
  if (isAuthed) {
    const failed = accept.error ?? decline.error;
    const wrongAccount =
      failed instanceof ApiError && failed.statusCode === 403;
    const errorMessage = failed
      ? wrongAccount
        ? t("invitation.wrongAccount")
        : failed instanceof ApiError
          ? isTransportError(failed)
            ? t("errors.networkUnavailable")
            : failed.message
          : t("invitation.actionFailed")
      : null;

    return (
      <AuthSplitShell
        title={t("invitation.title")}
        subtitle={t("invitation.reviewDescription")}
      >
        <InvitationSummary invitation={invitation} />
        {errorMessage && (
          <div className="mt-4">
            <AuthFormAlert>{errorMessage}</AuthFormAlert>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button
            className="h-10 flex-1"
            disabled={accept.isPending || decline.isPending}
            onClick={() => accept.mutate()}
          >
            {accept.isPending
              ? t("invitation.accepting")
              : t("invitation.accept")}
          </Button>
          <Button
            variant="outline"
            className="h-10 flex-1"
            disabled={accept.isPending || decline.isPending}
            onClick={() => decline.mutate()}
          >
            {t("invitation.decline")}
          </Button>
        </div>
      </AuthSplitShell>
    );
  }

  if (mode === "signup") {
    // 409 มีสองความหมาย และคำแนะนำต่างกันคนละทาง — "มีบัญชีแล้ว" ให้ไปเข้าสู่ระบบ ส่วน
    // INVITATION_ADDRESS_CONFLICT เข้าสู่ระบบไม่ได้เลยเพราะบัญชีที่ชนไม่ใช่ของเขา การเหมาว่า
    // 409 ทุกใบแปลว่า "มีบัญชีแล้ว" จึงส่งคนกลุ่มหลังไปชนกำแพงซึ่งเป็นทางตันที่สาขานี้ตั้งใจกำจัด
    // และเข้าถึงได้จริงเมื่อ account_state เป็น null (auth ตอบไม่ทัน) แล้วผู้ใช้กดสร้างบัญชี
    // backend เขียนข้อความของแต่ละ code ไว้ใน error catalog อยู่แล้ว และ `ApiError.from` เก็บไว้ที่
    // `serverMessage` จึงใช้ของ backend ก่อน แล้วค่อยถอยมาที่ข้อความแปลของเราเมื่ออ่าน body ไม่ได้
    const errorMessage =
      signup.error instanceof ApiError
        ? signup.error.statusCode === 409
          ? (signup.error.serverMessage ?? t("invitation.alreadyHasAccount"))
          : signup.error.statusCode === 410
            ? t("invitation.deadDescription")
            : isTransportError(signup.error)
              ? t("errors.networkUnavailable")
              : signup.error.message
        : signup.error
          ? t("signup.createFailed")
          : null;

    return (
      <AuthSplitShell
        title={t("invitation.title")}
        subtitle={t("invitation.signupDescription")}
      >
        <InvitationSummary invitation={invitation} />
        <SignupProfileForm
          onSubmit={(values) => signup.mutate(values)}
          isPending={signup.isPending}
          errorMessage={errorMessage}
          submitLabel={
            signup.isPending
              ? t("signup.creating")
              : t("invitation.createAndJoin")
          }
        />
      </AuthSplitShell>
    );
  }

  // อ่าน account_state ก่อน แล้วถอยไป has_account เมื่อ backend ยังไม่ได้ deploy ฟิลด์ใหม่
  // `owned` เท่านั้นที่แปลว่าต้องเข้าสู่ระบบ — `reclaimable` สมัครทับได้แล้วตั้งแต่มีการยึดอีเมลคืน
  // ส่วน null ยังคงสองทางเลือกไว้เหมือนเดิม เพราะเดาผิดทางไหนก็พาผู้ใช้ไปชนกำแพง — เดาว่าไม่มีบัญชี
  // จะจบที่ 409 หลังกรอกฟอร์ม เดาว่ามีจะขังคนไว้ที่หน้าเข้าสู่ระบบที่เขาผ่านไม่ได้
  const accountState = invitation.account_state ?? null;
  const isConflict = accountState === "conflict";
  const hasAccount =
    accountState === null ? invitation.has_account : accountState === "owned";

  return (
    <AuthSplitShell
      title={t("invitation.title")}
      subtitle={
        isConflict
          ? t("invitation.conflictDescription")
          : hasAccount === true
            ? t("invitation.signInDescription")
            : hasAccount === false
              ? t("invitation.createDescription")
              : t("invitation.chooseDescription")
      }
    >
      <InvitationSummary invitation={invitation} />
      {isConflict ? (
        // ไม่มีปุ่มใด ๆ โดยเจตนา ทุกทางที่กดได้จากตรงนี้พาไปตัน — เข้าสู่ระบบก็ไม่ได้เพราะบัญชีที่ชน
        // เป็นของคนอื่น สมัครก็ได้ 409 การให้ปุ่มที่กดแล้วล้มเหลวแย่กว่าการบอกตรง ๆ ว่าต้องรอผู้ดูแล
        <p className="text-muted-foreground mt-4 text-xs">
          {t("invitation.addressConflict")}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {hasAccount !== true && (
            <Button className="h-10 w-full" onClick={() => setMode("signup")}>
              {t("invitation.createAccount")}
            </Button>
          )}
          {hasAccount !== false && (
            <Button
              variant={hasAccount === true ? "default" : "outline"}
              className="h-10 w-full"
              asChild
            >
              <Link
                to={`/login?next=${encodeURIComponent(`/invitations/${token}`)}`}
              >
                {hasAccount === true
                  ? t("signIn")
                  : t("invitation.haveAccount")}
              </Link>
            </Button>
          )}
          {/* Google signs the invitee in (creating the account if the address is new) and brings them back here,
              signed in: they then press Accept themselves, and the backend checks the address matches. */}
          <GoogleSignInButton
            next={`/invitations/${encodeURIComponent(token)}`}
          />
        </div>
      )}
    </AuthSplitShell>
  );
}
