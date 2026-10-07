import { query } from '../db/index.js';

export async function getProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const profileRes = await query(
      `SELECT
         p.id, p.user_id, p.age, p.gender, p.state, p.district,
         p.occupation, p.annual_income, p.social_category,
         p.land_holding_acres, p.education_level, p.is_student,
         p.is_farmer, p.is_business_owner, p.family_size, p.notes,
         p.created_at, p.updated_at,
         u.full_name, u.email, u.preferred_language
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1`,
      [userId]
    );

    if (profileRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Profile not found for this user',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        profile: profileRes.rows[0],
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      age,
      gender,
      state,
      district,
      occupation,
      annual_income,
      social_category,
      land_holding_acres,
      education_level,
      is_student,
      is_farmer,
      is_business_owner,
      family_size,
      notes,
    } = req.body;

    const updateRes = await query(
      `INSERT INTO profiles (
         user_id, age, gender, state, district, occupation, annual_income,
         social_category, land_holding_acres, education_level,
         is_student, is_farmer, is_business_owner, family_size, notes, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         age = COALESCE(EXCLUDED.age, profiles.age),
         gender = COALESCE(EXCLUDED.gender, profiles.gender),
         state = COALESCE(EXCLUDED.state, profiles.state),
         district = COALESCE(EXCLUDED.district, profiles.district),
         occupation = COALESCE(EXCLUDED.occupation, profiles.occupation),
         annual_income = COALESCE(EXCLUDED.annual_income, profiles.annual_income),
         social_category = COALESCE(EXCLUDED.social_category, profiles.social_category),
         land_holding_acres = COALESCE(EXCLUDED.land_holding_acres, profiles.land_holding_acres),
         education_level = COALESCE(EXCLUDED.education_level, profiles.education_level),
         is_student = COALESCE(EXCLUDED.is_student, profiles.is_student),
         is_farmer = COALESCE(EXCLUDED.is_farmer, profiles.is_farmer),
         is_business_owner = COALESCE(EXCLUDED.is_business_owner, profiles.is_business_owner),
         family_size = COALESCE(EXCLUDED.family_size, profiles.family_size),
         notes = COALESCE(EXCLUDED.notes, profiles.notes),
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        age ?? null,
        gender ?? null,
        state ?? null,
        district ?? null,
        occupation ?? null,
        annual_income ?? null,
        social_category ?? null,
        land_holding_acres ?? null,
        education_level ?? null,
        is_student ?? null,
        is_farmer ?? null,
        is_business_owner ?? null,
        family_size ?? null,
        notes ?? null,
      ]
    );

    return res.json({
      success: true,
      data: {
        profile: updateRes.rows[0],
      },
    });
  } catch (err) {
    next(err);
  }
}
