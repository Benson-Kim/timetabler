import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { MdLogin, MdOutlineHttps } from "react-icons/md";

import { userLogin } from "../api";

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    handleSubmit,
    formState: { errors },
    register,
  } = useForm();

  const handleLoginSubmit = async (data) => {
    setLoading(true);
    setError("");
    try {
      const response = await userLogin(data);
      if (response.data && response.data.token) {
        localStorage.setItem("token", response.data.token);
        navigate("/app");
      } else {
        setError("Invalid credentials");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen justify-center items-center">
      {/* Login Card */}
      <div className="bg-light-gray w-[400px] p-5 pt-2 rounded-box ">
        <div className="bg-dark-orange text-white rounded-box p-3 flex items-center justify-center mt-5 gap-5">
          <MdOutlineHttps />

          <h4 className="text-center font-bold capitalize">Welcome Back</h4>
        </div>
        <hr className="opacity-30 my-5" />
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        <form
          onSubmit={handleSubmit(handleLoginSubmit)}
          className="flex flex-col mt-6"
        >
          <div className="my-3">
            <input
              type="text"
              id="username"
              className={`w-full py-2 px-4 text-primary-black/80 border focus:outline-none focus:ring-0 bg-light-gray rounded-btn ${
                errors.username
                  ? "border-red-400 focus:border-red-600"
                  : "border-dark-green/50 focus:border-dark-green"
              }`}
              {...register("username", {
                required: "Username is required",
              })}
              placeholder="Enter your username"
            />
            {errors.username && (
              <p className="text-red-600 text-sm mt-1">
                {errors.username.message}
              </p>
            )}
          </div>
          <div className="my-3">
            <input
              id="password"
              type="password"
              className={`w-full py-2 px-4 text-primary-black/80 border focus:outline-none focus:ring-0 bg-light-gray rounded-btn ${
                errors.password
                  ? "border-red-400 focus:border-red-600"
                  : "border-dark-green/50 focus:border-dark-green"
              }`}
              {...register("password", {
                required: "Password is required",
              })}
              placeholder="Enter your password"
            />
            {errors.password && (
              <p className="text-red-600 text-sm mt-1">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="mt-8 flex justify-between items-center flex-1 w-full">
            <Link
              className="text-sm font-semibold hover:text-light-gray w-2/3"
              to="/forgot-password"
            >
              Forgot your password?
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="bg-dark-orange hover:bg-dark-orange/95 disabled:bg-dark-orange/50 font-semibold text-light-gray py-2 px-4 rounded inline-flex gap-2.5 items-center"
            >
              <MdLogin />
              <span>{loading ? "Logging in..." : "Continue"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
