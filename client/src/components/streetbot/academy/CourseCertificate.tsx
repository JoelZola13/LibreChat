import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Award,
  Download,
  Share2,
  CheckCircle,
  Calendar,
  Shield,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { sbFetch } from "../shared/sbFetch";

type Certificate = {
  id: string;
  user_id: string;
  course_id: string;
  certificate_url?: string | null;
  badge_url?: string | null;
  verification_code: string;
  issued_at: string;
  expires_at?: string | null;
};

type Course = {
  id: string;
  title: string;
  instructor_name?: string | null;
  duration?: string | null;
};

type CourseCertificateProps = {
  courseId: string;
  userId: string;
  course: Course;
  userName?: string;
  onCertificateIssued?: (certificate: Certificate) => void;
};

export function CourseCertificate({
  courseId,
  userId,
  course,
  userName = "Student",
  onCertificateIssued,
}: CourseCertificateProps) {
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isIssuing, setIsIssuing] = useState(false);
  const [copied, setCopied] = useState(false);
  const certificateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // Check completion status
        const completionResp = await sbFetch(
          `/api/academy/certificates/check-completion?user_id=${userId}&course_id=${courseId}`
        );
        if (completionResp.ok) {
          const data = await completionResp.json();
          setIsCompleted(data.is_completed);
        }

        // Check for existing certificate
        const certsResp = await sbFetch(`/api/academy/certificates/${userId}`);
        if (certsResp.ok) {
          const certs = await certsResp.json();
          const courseCert = certs.find(
            (c: Certificate) => c.course_id === courseId
          );
          if (courseCert) {
            setCertificate(courseCert);
          }
        }
      } catch (e) {
        console.error("Failed to load certificate data:", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [courseId, userId]);

  const handleIssueCertificate = async () => {
    setIsIssuing(true);
    try {
      const resp = await sbFetch(
        `/api/academy/certificates/auto-issue?user_id=${userId}&course_id=${courseId}`,
        { method: "POST" }
      );

      if (resp.ok) {
        const cert = await resp.json();
        if (cert) {
          setCertificate(cert);
          onCertificateIssued?.(cert);
        }
      }
    } catch (e) {
      console.error("Failed to issue certificate:", e);
    } finally {
      setIsIssuing(false);
    }
  };

  const copyVerificationCode = () => {
    if (certificate) {
      navigator.clipboard.writeText(certificate.verification_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!certificate) return;

    const verifyUrl = `${window.location.origin}/academy/verify/${certificate.verification_code}`;
    const shareData = {
      title: `Certificate of Completion - ${course.title}`,
      text: `I completed ${course.title} on Street Voices Academy!`,
      url: verifyUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (e) {
        // User cancelled share
      }
    } else {
      navigator.clipboard.writeText(verifyUrl);
      alert("Verification URL copied to clipboard!");
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-3 border-yellow-400 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  // Not completed yet
  if (!isCompleted && !certificate) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-gray-800 mx-auto mb-4 flex items-center justify-center">
          <Award className="w-10 h-10 text-gray-600" />
        </div>
        <h3 className="text-xl font-bold mb-2">Certificate of Completion</h3>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Complete all required lessons in this course to earn your certificate.
          Track your progress and keep learning!
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-full text-sm text-gray-400">
          <CheckCircle className="w-4 h-4" />
          Complete all lessons to unlock
        </div>
      </div>
    );
  }

  // Completed but no certificate yet
  if (isCompleted && !certificate) {
    return (
      <div className="bg-gradient-to-br from-yellow-400/10 to-cyan-400/10 border border-yellow-400/30 rounded-2xl p-8 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring" }}
          className="w-20 h-20 rounded-full bg-yellow-400/20 mx-auto mb-4 flex items-center justify-center"
        >
          <Award className="w-10 h-10 text-yellow-400" />
        </motion.div>
        <h3 className="text-xl font-bold mb-2">Congratulations!</h3>
        <p className="text-gray-400 mb-6">
          You&apos;ve completed all required lessons. Claim your certificate now!
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleIssueCertificate}
          disabled={isIssuing}
          className="inline-flex items-center gap-2 px-8 py-4 bg-yellow-400 text-black rounded-xl font-bold hover:bg-yellow-300 disabled:opacity-50 transition-colors"
        >
          {isIssuing ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-5 h-5 border-2 border-black border-t-transparent rounded-full"
            />
          ) : (
            <>
              <Award className="w-5 h-5" />
              Claim Certificate
            </>
          )}
        </motion.button>
      </div>
    );
  }

  // Has certificate
  return (
    <div className="space-y-6">
      {/* Certificate Preview */}
      <div
        ref={certificateRef}
        className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-2 border-yellow-400/50 rounded-2xl p-8 relative overflow-hidden"
      >
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-yellow-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-cyan-400/10 rounded-full blur-3xl" />

        {/* Corner decorations */}
        <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-yellow-400/50" />
        <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-yellow-400/50" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-yellow-400/50" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-yellow-400/50" />

        <div className="relative z-10 text-center">
          {/* Header */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <Award className="w-8 h-8 text-yellow-400" />
            <span className="text-sm tracking-widest uppercase text-yellow-400 font-medium">
              Certificate of Completion
            </span>
          </div>

          {/* Recipient */}
          <p className="text-gray-400 text-sm mb-2">This certifies that</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {userName}
          </h2>
          <p className="text-gray-400 text-sm mb-6">has successfully completed</p>

          {/* Course */}
          <h3 className="text-xl md:text-2xl font-bold text-yellow-400 mb-2">
            {course.title}
          </h3>
          {course.instructor_name && (
            <p className="text-gray-500 text-sm mb-6">
              Instructed by {course.instructor_name}
            </p>
          )}

          {/* Details */}
          <div className="flex items-center justify-center gap-8 text-sm text-gray-400 mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {certificate && formatDate(certificate.issued_at)}
            </div>
            {course.duration && (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                {course.duration}
              </div>
            )}
          </div>

          {/* Verification */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-full text-xs text-gray-400">
            <Shield className="w-4 h-4 text-cyan-400" />
            Verification Code: {certificate?.verification_code}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={copyVerificationCode}
          className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-5 h-5 text-green-400" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-5 h-5" />
              Copy Code
            </>
          )}
        </button>

        <button
          onClick={handleShare}
          className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors"
        >
          <Share2 className="w-5 h-5" />
          Share
        </button>

        <a
          href={`/academy/verify/${certificate?.verification_code}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 bg-yellow-400 text-black rounded-xl font-medium hover:bg-yellow-300 transition-colors"
        >
          <ExternalLink className="w-5 h-5" />
          Verify
        </a>
      </div>

      {/* Certificate Info */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          Certificate Details
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Issued</p>
            <p className="text-white">
              {certificate && formatDate(certificate.issued_at)}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Verification Code</p>
            <p className="text-white font-mono text-xs">
              {certificate?.verification_code}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Status</p>
            <p className="text-green-400 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Valid
            </p>
          </div>
          <div>
            <p className="text-gray-500">Expires</p>
            <p className="text-white">
              {certificate?.expires_at
                ? formatDate(certificate.expires_at)
                : "Never"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
