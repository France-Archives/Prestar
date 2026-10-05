// Server/models/index.js
import { Sequelize } from "sequelize";
import config from "../config/config.js";
import defineUser from "./User.js";
import defineStudent from "./Student.js";
import defineCourse from "./Course.js";
import defineCollege from "./College.js";
import defineSignup from "./Signup.js";
import defineSignupVerification from "./SignupVerification.js";

export const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  config,
);

export const User = defineUser(sequelize);
export const Student = defineStudent(sequelize);
export const Course = defineCourse(sequelize);
export const College = defineCollege(sequelize);
export const Signup = defineSignup(sequelize);
export const SignupVerification = defineSignupVerification(sequelize);

Course.belongsTo(College, { foreignKey: "college_id", as: "college" });
College.hasMany(Course, { foreignKey: "college_id", as: "courses" });
Student.belongsTo(Course, { foreignKey: "course_id", as: "course" });
Course.hasMany(Student, { foreignKey: "course_id", as: "students" });

// These associations reflect logical links. The live schema currently has no
// foreign-key constraints on students.student_id or signups.student_id.
User.belongsTo(Student, { foreignKey: "student_id", targetKey: "student_id", as: "student", constraints: false });
Student.hasOne(User, { foreignKey: "student_id", sourceKey: "student_id", as: "user", constraints: false });
Signup.belongsTo(Student, { foreignKey: "student_id", targetKey: "student_id", as: "matchedStudent", constraints: false });
Signup.belongsTo(User, { foreignKey: "created_user_id", as: "createdUser" });
Signup.belongsTo(User, { foreignKey: "reviewed_by", as: "reviewer" });
Signup.hasMany(SignupVerification, { foreignKey: "signup_id", as: "verifications" });
SignupVerification.belongsTo(Signup, { foreignKey: "signup_id", as: "signup" });
SignupVerification.belongsTo(User, { foreignKey: "actor_id", as: "actor" });

export default sequelize;