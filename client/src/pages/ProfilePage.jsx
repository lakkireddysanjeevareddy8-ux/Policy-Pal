import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { User, Save, Loader2, CheckCircle2, ShieldCheck, Globe } from 'lucide-react';

export default function ProfilePage() {
  const { user, language, setLanguage, t } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    age: '',
    gender: '',
    state: '',
    district: '',
    occupation: '',
    annual_income: '',
    social_category: '',
    land_holding_acres: '',
    education_level: '',
    is_student: false,
    is_farmer: false,
    is_business_owner: false,
    family_size: '',
    notes: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        const res = await api.get('/profile');
        if (res.data?.success && res.data?.data?.profile) {
          const p = res.data.data.profile;
          setFormData({
            age: p.age ?? '',
            gender: p.gender ?? '',
            state: p.state ?? '',
            district: p.district ?? '',
            occupation: p.occupation ?? '',
            annual_income: p.annual_income ?? '',
            social_category: p.social_category ?? '',
            land_holding_acres: p.land_holding_acres ?? '',
            education_level: p.education_level ?? '',
            is_student: !!p.is_student,
            is_farmer: !!p.is_farmer,
            is_business_owner: !!p.is_business_owner,
            family_size: p.family_size ?? '',
            notes: p.notes ?? '',
          });
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        showToast('Failed to load profile', 'error');
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        age: formData.age !== '' ? parseInt(formData.age, 10) : null,
        gender: formData.gender || null,
        state: formData.state || null,
        district: formData.district || null,
        occupation: formData.occupation || null,
        annual_income: formData.annual_income !== '' ? parseFloat(formData.annual_income) : null,
        social_category: formData.social_category || null,
        land_holding_acres:
          formData.land_holding_acres !== '' ? parseFloat(formData.land_holding_acres) : null,
        education_level: formData.education_level || null,
        is_student: formData.is_student,
        is_farmer: formData.is_farmer,
        is_business_owner: formData.is_business_owner,
        family_size: formData.family_size !== '' ? parseInt(formData.family_size, 10) : null,
        notes: formData.notes || null,
      };

      const res = await api.put('/profile', payload);
      if (res.data?.success) {
        showToast('Citizen profile updated successfully!', 'success');
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
      showToast('Failed to update profile. Please verify your fields.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <div className="h-8 bg-slate-200 rounded-lg w-48 animate-pulse" />
        <div className="h-96 bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <User className="w-7 h-7 text-emerald-600" />
          <span>{t('profile')}</span>
        </h1>
        <p className="text-sm text-slate-600">
          Save your personal and household details to streamline scheme eligibility checks
        </p>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
        {/* User Account Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white font-extrabold flex items-center justify-center text-lg shadow-sm">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{user?.full_name}</h3>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>

          {/* Language preference */}
          <div className="flex items-center gap-2 text-xs">
            <Globe className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-600">Language:</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-bold text-slate-800"
            >
              <option value="en">English</option>
              <option value="te">తెలుగు (Telugu)</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </select>
          </div>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Age */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Age
              </label>
              <input
                type="number"
                min="0"
                max="125"
                name="age"
                value={formData.age}
                onChange={handleChange}
                placeholder="e.g. 42"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Gender
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="transgender">Transgender</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Social Category */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Social Category
              </label>
              <select
                name="social_category"
                value={formData.social_category}
                onChange={handleChange}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select category</option>
                <option value="General">General</option>
                <option value="OBC">OBC</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
                <option value="EWS">EWS</option>
              </select>
            </div>

            {/* State */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                State
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="e.g. Telangana, Andhra Pradesh"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* District */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                District
              </label>
              <input
                type="text"
                name="district"
                value={formData.district}
                onChange={handleChange}
                placeholder="e.g. Rangareddy"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Occupation */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Occupation
              </label>
              <input
                type="text"
                name="occupation"
                value={formData.occupation}
                onChange={handleChange}
                placeholder="e.g. Farmer, Artisan, Student"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Annual Income */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Annual Family Income (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                name="annual_income"
                value={formData.annual_income}
                onChange={handleChange}
                placeholder="e.g. 180000"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Land Holding */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Land Holding (Acres)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                name="land_holding_acres"
                value={formData.land_holding_acres}
                onChange={handleChange}
                placeholder="e.g. 2.5"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Family Size */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Family Size
              </label>
              <input
                type="number"
                min="1"
                name="family_size"
                value={formData.family_size}
                onChange={handleChange}
                placeholder="e.g. 4"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Citizen Type Checkboxes */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
              Citizen Profile Attributes
            </span>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="is_farmer"
                  checked={formData.is_farmer}
                  onChange={handleChange}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Active Farmer / Cultivator</span>
              </label>

              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="is_student"
                  checked={formData.is_student}
                  onChange={handleChange}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Enrolled Student</span>
              </label>

              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="is_business_owner"
                  checked={formData.is_business_owner}
                  onChange={handleChange}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Micro Enterprise / Small Business Owner</span>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Household Notes & Goals
            </label>
            <textarea
              rows={3}
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any additional background, e.g. looking for health coverage or crop loan..."
              className="w-full p-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow transition flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Profile Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
