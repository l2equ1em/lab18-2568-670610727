import e, { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

import type { User, CustomRequest, UserPayload, Enrollment } from "../libs/types.js";

// import database
import { tr } from "zod/locales";
import { enrollments, reset_enrollments ,DB, students } from "../db/db.js";

// import middlewares
import { authenticateToken } from "../middlewares/authenMiddleware.js";
import { checkRoleAdmin } from "../middlewares/checkRoleAdminMiddleware.js";
import { checkRoleStudent } from "../middlewares/checkRoleStudentMiddleware.js";
import { checkAllRole } from "../middlewares/checkAllRoleMiddleware.js";

const router = Router();

// Get /api/v2/enrollments (ADMIN Only)
router.get("/", authenticateToken, checkRoleAdmin, (req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      data: enrollments,
    });
    } catch (err) {
        return res.status(500).json({
        success: false,
        message: "Something is wrong, please try again",
        error: err,
        });
    }
});

// POST /api/v2/enrollments/reset
router.post("/reset",authenticateToken,checkRoleAdmin, (req: Request, res: Response) => {
  try {
    reset_enrollments();
    return res.status(200).json({
      success: true,
      message: "Enrollments database has been reset",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Something is wrong, please try again",
      error: err,
    });
  }
});

// GET /api/v2/enrollments/:studentId (ADMIN and STUDENT with condition)
router.get("/:studentId", authenticateToken, (req: Request, res: Response, next) => {
    const user = (req as any).user; 
    const { studentId } = req.params;

    // block กรณี STUDENT เข้าถึงข้อมูลของคนอื่น
    if (user.role === "STUDENT" && user.studentId !== studentId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden access",
      });
    }

    // ถ้า ADMIN จะผ่าน
    next();
  },
  // เข้าได้ทั้ง admin และ student ที่รหัสตรงกับตัวเอง
  checkAllRole,
  (req: Request, res: Response) => {
    const user = (req as any).user;
    const { studentId } = req.params;

    // หา enrollments ของ studentId นี้
    const studentEnrollments = enrollments
      .filter((e) => e.studentId === studentId)
      .map((e) => e.courseId);

    if (studentEnrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No enrollments found",
      });
    }

    // คืนข้อมูลแบบรวมกับ student info
    const studentInfo = students.find((s) => s.studentId === studentId);

    return res.status(200).json({
      success: true,
      message: "Student Information",
      data: {
        studentId,
        firstName: studentInfo?.firstName || "",
        lastName: studentInfo?.lastName || "",
        program: studentInfo?.program || "",
        courses: studentEnrollments,
      },
    });
  }
);

// add enrollment (STUDENT only)
router.post("/:studentId", authenticateToken, (req: CustomRequest, res: Response) => {

    const user = (req as any).user;
    const { studentId } = req.params;
    const { courseId } = req.body;

    // studentId ต้องตรงกับของตนเอง
    if (user.role !== "STUDENT" || user.studentId !== studentId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden access",
      });
    }

    // ตรวจสอบ courseId
    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "courseId is required",
      });
    }

    // ตรวจสอบว่ามี course อยู่แล้วหรือยัง
    const exists = enrollments.find(
      (e) => e.studentId === studentId && e.courseId === courseId
    );
    if (exists) {
      return res.status(400).json({
        success: false,
        message: `Student ${studentId} and course ${courseId} is already exists`,
      });
    }
    // ตรวจสอบว่ามีค่าไหม    
    if (!studentId || !courseId) {
      return res.status(400).json({
        success: false,
        message: "studentId and courseId are required",
      });
    }

    // ตอนนี้ TypeScript มั่นใจว่าเป็น string
    const newEnroll: Enrollment = { studentId, courseId };
    // เพิ่ม enrollment
    enrollments.push(newEnroll);


    return res.status(200).json({
      success: true,
      message: `Student ${studentId} && course ${courseId} has been added successfully`,
      data: {
        newEnroll,
      },
    });
  }
);

// DELETE /api/v2/enrollments/:studentId (STUDENT only)
router.delete(
  "/:studentId",
  authenticateToken,
  (req: Request, res: Response) => {
    const user = (req as any).user;
    const { studentId } = req.params;
    const { courseId } = req.body;

    // ตรวจสอบ role
    if (user.role !== "STUDENT" || user.studentId !== studentId) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to modify another student's data",
      });
    }

    // ตรวจสอบ courseId จาก body
    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "courseId is required",
      });
    }

    // หา index ของ enrollment
    const index = enrollments.findIndex(
      (e) => e.studentId === studentId && e.courseId === courseId
    );

    if (index === -1) {
      // ไม่พบวิชาที่ต้องการ drop
      return res.status(404).json({
        success: false,
        message: "Enrollment does not exist",
      });
    }

    // ลบ enrollment
    enrollments.splice(index, 1);

    return res.status(200).json({
      success: true,
      message: `Student ${studentId} && course ${courseId} has been deleted successfully`,
      data: enrollments.filter((e) => e.studentId === studentId), // วิชาที่เหลือ
    });
  }
);

export default router;