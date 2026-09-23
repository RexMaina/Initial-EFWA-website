import { useEffect, useRef, useState } from "react";
import "./App.css";
import { supabase } from "./lib/supabaseClient";
import logo from "./assets/logo.jpeg";
import efwaLogo from "./assets/efwa-logo.jpeg";
import image1 from "./assets/image1.jpeg";
import image2 from "./assets/image2.jpg";
import image3 from "./assets/image3.jpg";
import image6 from "./assets/image6.jpeg";
import image8 from "./assets/image8.jpeg";
import image9 from "./assets/image9.jpeg";
import imageF from "./assets/imagef.jpeg";
import imageG from "./assets/imageg.jpeg";
import imageA from "./assets/imagea.jpeg";
import imageB from "./assets/imageb.jpeg";
import imageC from "./assets/imagec.jpeg";
import imageD from "./assets/imaged.png";
import image4 from "./assets/image4.jpg";

const initialFormData = {

  fullName: "",

  phone: "",

  email: "",

  age: "",

  gender: "",

  location: "",

  height: "",

};

const initialDesignerFormData = {

  brandName: "",

  email: "",

  phone: "",

  location: "",

  showcase: [],

};

const initialExhibitorFormData = {

  brandName: "",

  productType: "",

  email: "",

  phone: "",

  location: "",

};

const AWARD_VOTE_FEE = 10;

const EXHIBITOR_FEE = 5000;

const DESIGNER_SHOWCASE_OPTIONS = [

  { value: "ladies_clothes", label: "Ladies Clothes", code: "LC" },

  { value: "mens_clothes", label: "Men's Clothes", code: "MC" },

  { value: "bags", label: "Bags", code: "BG" },

  { value: "shoes", label: "Shoes", code: "SH" },

];

const DESIGNER_FEES = {

  clothing: 10000,

  bags: 10000,

  shoes: 7500,

};

const MINIMUM_AGE = 18;

// All 47 counties of Kenya, in official county-code order.

const KENYAN_COUNTIES = [

  "Mombasa",

  "Kwale",

  "Kilifi",

  "Tana River",

  "Lamu",

  "Taita-Taveta",

  "Garissa",

  "Wajir",

  "Mandera",

  "Marsabit",

  "Isiolo",

  "Meru",

  "Tharaka-Nithi",

  "Embu",

  "Kitui",

  "Machakos",

  "Makueni",

  "Nyandarua",

  "Nyeri",

  "Kirinyaga",

  "Murang'a",

  "Kiambu",

  "Turkana",

  "West Pokot",

  "Samburu",

  "Trans Nzoia",

  "Uasin Gishu",

  "Elgeyo-Marakwet",

  "Nandi",

  "Baringo",

  "Laikipia",

  "Nakuru",

  "Narok",

  "Kajiado",

  "Kericho",

  "Bomet",

  "Kakamega",

  "Vihiga",

  "Bungoma",

  "Busia",

  "Siaya",

  "Kisumu",

  "Homa Bay",

  "Migori",

  "Kisii",

  "Nyamira",

  "Nairobi",

];

export default function App() {

  const navRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);

  const [applicationOpen, setApplicationOpen] = useState(false);

  const [formData, setFormData] = useState(initialFormData);

  const [photoFile, setPhotoFile] = useState(null);

  const [photoPreview, setPhotoPreview] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [submitMessage, setSubmitMessage] = useState("");

  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [paymentStage, setPaymentStage] = useState("idle");

  const [paymentExternalReference, setPaymentExternalReference] = useState("");

  const [designerOpen, setDesignerOpen] = useState(false);

  const [designerFormData, setDesignerFormData] = useState(initialDesignerFormData);

  const [designerSerialSeed, setDesignerSerialSeed] = useState("");

  const [designerIsSubmitting, setDesignerIsSubmitting] = useState(false);

  const [designerSubmitMessage, setDesignerSubmitMessage] = useState("");

  const [designerSubmitSuccess, setDesignerSubmitSuccess] = useState(false);

  const [designerPaymentStage, setDesignerPaymentStage] = useState("idle");

  const [designerPaymentExternalReference, setDesignerPaymentExternalReference] = useState("");

  const [exhibitorOpen, setExhibitorOpen] = useState(false);

  const [exhibitorFormData, setExhibitorFormData] = useState(initialExhibitorFormData);

  const [exhibitorIsSubmitting, setExhibitorIsSubmitting] = useState(false);

  const [exhibitorSubmitMessage, setExhibitorSubmitMessage] = useState("");

  const [exhibitorSubmitSuccess, setExhibitorSubmitSuccess] = useState(false);

  const [exhibitorPaymentStage, setExhibitorPaymentStage] = useState("idle");

  const [exhibitorPaymentExternalReference, setExhibitorPaymentExternalReference] = useState("");

  const [selectedMaleContestant, setSelectedMaleContestant] = useState("");

  const [selectedFemaleContestant, setSelectedFemaleContestant] = useState("");

  const [awardContestants, setAwardContestants] = useState([]);

  const [awardVoteMessage, setAwardVoteMessage] = useState("");

  const [awardVoteModalOpen, setAwardVoteModalOpen] = useState(false);

  const [awardVoteContestant, setAwardVoteContestant] = useState(null);

  const [awardVotePhone, setAwardVotePhone] = useState("");

  const [awardVoteIsSubmitting, setAwardVoteIsSubmitting] = useState(false);

  const [awardVotePaymentStage, setAwardVotePaymentStage] = useState("idle");

  const [awardVoteExternalReference, setAwardVoteExternalReference] = useState("");

  const [awardVotePaymentMessage, setAwardVotePaymentMessage] = useState("");

  const maleAwardContestants = awardContestants.filter(
    (contestant) => contestant.award_category === "male_model_of_the_year"
  );

  const femaleAwardContestants = awardContestants.filter(
    (contestant) => contestant.award_category === "female_model_of_the_year"
  );

  /* =========================================================

     NAV SCROLL + REVEAL ANIMATIONS

  ========================================================= */

  useEffect(() => {

    const onScroll = () => {

      if (navRef.current) {

        navRef.current.classList.toggle(

          "scrolled",

          window.scrollY > 60

        );

      }

    };

    window.addEventListener("scroll", onScroll);

    const obs = new IntersectionObserver(

      (entries) =>

        entries.forEach((entry) => {

          if (entry.isIntersecting) {

            entry.target.classList.add("visible");

          }

        }),

      {

        threshold: 0.12,

      }

    );

    document

      .querySelectorAll(".reveal")

      .forEach((el) => obs.observe(el));

    return () => {

      window.removeEventListener("scroll", onScroll);

      obs.disconnect();

    };

  }, []);

  /* =========================================================

     LOAD LIVE AWARD CONTESTANTS + VOTE COUNTS

  ========================================================= */

  useEffect(() => {

    let active = true;

    const loadAwardContestants = async () => {

      const { data, error } = await supabase

        .from("award_contestants")

        .select(
          "id,award_category,contestant_name,contestant_slug,display_order,vote_count,is_active"
        )

        .eq("is_active", true)

        .order("display_order", { ascending: true });

      if (!active) return;

      if (error) {

        console.error("Unable to load award contestants:", error);

        setAwardVoteMessage(
          "We could not load the current voting totals. Please refresh the page."
        );

        return;

      }

      setAwardContestants(data || []);

    };

    loadAwardContestants();

    return () => {

      active = false;

    };

  }, []);

  /* =========================================================

     LOCK PAGE SCROLL WHILE APPLICATION FORM IS OPEN

  ========================================================= */

  useEffect(() => {

    if (applicationOpen || designerOpen || exhibitorOpen || awardVoteModalOpen) {

      document.body.style.overflow = "hidden";

    } else {

      document.body.style.overflow = "";

    }

    return () => {

      document.body.style.overflow = "";

    };

  }, [applicationOpen, designerOpen, exhibitorOpen, awardVoteModalOpen]);

  /* =========================================================

     CLOSE FORM WITH ESCAPE KEY

  ========================================================= */

  useEffect(() => {

    const handleEscape = (event) => {

      if (event.key === "Escape") {

        setApplicationOpen(false);

        setDesignerOpen(false);

        setExhibitorOpen(false);

        if (!awardVoteIsSubmitting) {

          setAwardVoteModalOpen(false);

        }

      }

    };

    window.addEventListener("keydown", handleEscape);

    return () => {

      window.removeEventListener("keydown", handleEscape);

    };

  }, [awardVoteIsSubmitting]);

  /* =========================================================

     APPLICATION HANDLERS

  ========================================================= */

  const handleApplicationOpen = () => {

    setMenuOpen(false);

    setSubmitMessage("");

    setSubmitSuccess(false);

    setApplicationOpen(true);

  };

  const handleApplicationClose = () => {

    if (isSubmitting) return;

    setApplicationOpen(false);

    setSubmitMessage("");

    setSubmitSuccess(false);

  };

  const handleInputChange = (event) => {

    const { name, value } = event.target;

    setFormData((previousData) => ({

      ...previousData,

      [name]: value,

    }));

  };

  /* =========================================================

     DESIGNER APPLICATION HANDLERS

  ========================================================= */

  const handleDesignerOpen = () => {

    setMenuOpen(false);

    setDesignerSubmitMessage("");

    setDesignerSubmitSuccess(false);

    setDesignerPaymentStage("idle");

    setDesignerPaymentExternalReference("");

    setDesignerSerialSeed(

      Date.now().toString(36).toUpperCase().slice(-6)

    );

    setDesignerOpen(true);

  };

  const handleDesignerClose = () => {

    if (designerIsSubmitting) return;

    setDesignerOpen(false);

    setDesignerSubmitMessage("");

    setDesignerSubmitSuccess(false);

  };

  const handleDesignerInputChange = (event) => {

    const { name, value } = event.target;

    setDesignerFormData((previousData) => ({

      ...previousData,

      [name]: value,

    }));

  };

  const handleDesignerShowcaseChange = (event) => {

    const { value, checked } = event.target;

    setDesignerFormData((previousData) => ({

      ...previousData,

      showcase: checked

        ? [...previousData.showcase, value]

        : previousData.showcase.filter((item) => item !== value),

    }));

  };

  const designerHasClothing =

    designerFormData.showcase.includes("ladies_clothes") ||

    designerFormData.showcase.includes("mens_clothes");

  const designerTotal =

    (designerHasClothing ? DESIGNER_FEES.clothing : 0) +

    (designerFormData.showcase.includes("bags") ? DESIGNER_FEES.bags : 0) +

    (designerFormData.showcase.includes("shoes") ? DESIGNER_FEES.shoes : 0);

  const designerSerialCodes = DESIGNER_SHOWCASE_OPTIONS

    .filter((option) => designerFormData.showcase.includes(option.value))

    .map((option) => option.code);

  const designerSerialNumber =

    designerSerialCodes.length && designerSerialSeed

      ? `EFWA-DES-${designerSerialCodes.join("-")}-${designerSerialSeed}`

      : "";

  /* =========================================================

     EXHIBITOR APPLICATION HANDLERS

  ========================================================= */

  const handleExhibitorOpen = () => {

    setMenuOpen(false);

    setExhibitorSubmitMessage("");

    setExhibitorSubmitSuccess(false);

    setExhibitorPaymentStage("idle");

    setExhibitorPaymentExternalReference("");

    setExhibitorOpen(true);

  };

  const handleExhibitorClose = () => {

    if (exhibitorIsSubmitting) return;

    setExhibitorOpen(false);

    setExhibitorSubmitMessage("");

    setExhibitorSubmitSuccess(false);

  };

  const handleExhibitorInputChange = (event) => {

    const { name, value } = event.target;

    setExhibitorFormData((previousData) => ({

      ...previousData,

      [name]: value,

    }));

  };

  /* =========================================================

     PHOTO UPLOAD HANDLERS

  ========================================================= */

  const handlePhotoChange = (event) => {

    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {

      setSubmitMessage("Please upload an image file (JPG or PNG).");

      return;

    }

    if (file.size > 5 * 1024 * 1024) {

      setSubmitMessage("Image must be under 5MB.");

      return;

    }

    setSubmitMessage("");

    setPhotoFile(file);

    setPhotoPreview(URL.createObjectURL(file));

  };

  const handlePhotoRemove = () => {

    setPhotoFile(null);

    setPhotoPreview("");

  };

  /* =========================================================

     PAYHERO + SUPABASE PAYMENT FLOW

  ========================================================= */

  const sleep = (milliseconds) =>

    new Promise((resolve) => setTimeout(resolve, milliseconds));

  const readFunctionError = async (error, fallbackMessage) => {

    try {

      if (error?.context?.json) {

        const body = await error.context.json();

        return body?.error || body?.message || fallbackMessage;

      }

    } catch {

      // Ignore response parsing problems and use the fallback below.

    }

    return error?.message || fallbackMessage;

  };

  const checkPayment = async (externalReference) => {

    const { data, error } = await supabase.functions.invoke(

      "check-payment",

      {

        body: { externalReference },

      }

    );

    if (error) {

      const message = await readFunctionError(

        error,

        "Unable to check the payment status."

      );

      throw new Error(message);

    }

    return data;

  };

  const finalizeApplication = async (externalReference) => {

    setPaymentStage("finalizing");

    setSubmitMessage(

      "Payment confirmed. Submitting your application..."

    );

    const payload = new FormData();

    payload.append("externalReference", externalReference);

    payload.append("fullName", formData.fullName.trim());

    payload.append("phone", formData.phone.trim());

    payload.append("email", formData.email.trim());

    payload.append("age", String(Number(formData.age)));

    payload.append("gender", formData.gender);

    payload.append("location", formData.location.trim());

    payload.append("height", String(Number(formData.height)));

    payload.append("photo", photoFile);

    const { data, error } = await supabase.functions.invoke(

      "finalize-application",

      {

        body: payload,

      }

    );

    if (error) {

      const message = await readFunctionError(

        error,

        "Payment was received, but the application could not be saved."

      );

      throw new Error(message);

    }

    if (!data?.success) {

      throw new Error(

        data?.message ||

          "Payment was received, but the application could not be saved."

      );

    }

    setPaymentStage("success");

    setSubmitSuccess(true);

    setSubmitMessage(

      "Payment confirmed. Application submitted successfully."

    );

    setFormData(initialFormData);

    setPhotoFile(null);

    setPhotoPreview("");

    setPaymentExternalReference("");

  };

  const waitForPayment = async (externalReference) => {

    // Check for up to two minutes. PayHero will update Supabase through

    // the callback Edge Function when M-Pesa reaches a final state.

    for (let attempt = 0; attempt < 40; attempt += 1) {

      const payment = await checkPayment(externalReference);

      if (payment?.status === "paid") {

        await finalizeApplication(externalReference);

        return "paid";

      }

      if (payment?.status === "failed") {

        setPaymentStage("failed");

        setPaymentExternalReference("");

            setSubmitSuccess(false);

        setSubmitMessage(

          payment?.message ||

            "Payment was not completed. No application was submitted. You can try again."

        );

        return "failed";

      }

      await sleep(3000);

    }

    setPaymentStage("pending");

    setSubmitSuccess(false);

    setSubmitMessage(

      "Payment is still pending. If you approved the M-Pesa prompt, click Check Payment Status. Do not pay again."

    );

    return "pending";

  };

  const resumePaymentCheck = async () => {

    if (!paymentExternalReference || isSubmitting) return;

    setIsSubmitting(true);

    setSubmitMessage("Checking your M-Pesa payment...");

    setSubmitSuccess(false);

    try {

      const payment = await checkPayment(paymentExternalReference);

      if (payment?.status === "paid") {

        await finalizeApplication(paymentExternalReference);

      } else if (payment?.status === "failed") {

        setPaymentStage("failed");

        setPaymentExternalReference("");

            setSubmitMessage(

          payment?.message ||

            "Payment was not completed. No application was submitted. You can try again."

        );

      } else {

        setPaymentStage("pending");

        setSubmitMessage(

          "Payment is still pending. Do not start another payment yet."

        );

      }

    } catch (error) {

      console.error("Payment status error:", error);

      setPaymentStage("pending");

      setSubmitMessage(

        error?.message ||

          "We could not confirm the payment yet. Please try checking again."

      );

    } finally {

      setIsSubmitting(false);

    }

  };

  const handleSubmit = async (event) => {

    event.preventDefault();

    if (isSubmitting) return;

    if (paymentStage === "pending" && paymentExternalReference) {

      await resumePaymentCheck();

      return;

    }

    if (!photoFile) {

      setSubmitMessage("Please upload a photo before continuing to payment.");

      setSubmitSuccess(false);

      return;

    }

    const ageValue = Number(formData.age);

    if (!Number.isFinite(ageValue) || ageValue < MINIMUM_AGE) {

      setSubmitMessage(

        `You must be at least ${MINIMUM_AGE} years old to apply.`

      );

      setSubmitSuccess(false);

      return;

    }

    setIsSubmitting(true);

    setSubmitMessage("");

    setSubmitSuccess(false);

    setPaymentStage("initiating");

    try {

      const { data, error } = await supabase.functions.invoke(

        "initiate-payment",

        {

          body: {

            phone: formData.phone.trim(),

          },

        }

      );

      if (error) {

        const message = await readFunctionError(

          error,

          "Unable to start the M-Pesa payment."

        );

        throw new Error(message);

      }

      if (!data?.externalReference) {

        throw new Error(

          data?.message || "PayHero did not return a payment reference."

        );

      }

      setPaymentExternalReference(data.externalReference);

      setPaymentStage("waiting");

      setSubmitMessage(

        "M-Pesa request sent. Check your phone and enter your M-Pesa PIN. Waiting for payment confirmation..."

      );

      await waitForPayment(data.externalReference);

    } catch (error) {

      console.error("Payment initiation error:", error);

      setPaymentStage("idle");

      setSubmitSuccess(false);

      setSubmitMessage(

        error?.message ||

          "We could not start the payment. Please check the phone number and try again."

      );

    } finally {

      setIsSubmitting(false);

    }

  };

  /* =========================================================

     DESIGNER PAYMENT FLOW

  ========================================================= */

  const finalizeDesignerApplication = async (externalReference) => {

    setDesignerPaymentStage("finalizing");

    setDesignerSubmitMessage(

      "Payment confirmed. Registering your designer showcase..."

    );

    const { data, error } = await supabase.functions.invoke(

      "finalize-designer-application",

      {

        body: {

          externalReference,

          brandName: designerFormData.brandName.trim(),

          email: designerFormData.email.trim(),

          phone: designerFormData.phone.trim(),

          location: designerFormData.location,

          showcase: designerFormData.showcase,

          serialNumber: designerSerialNumber,

        },

      }

    );

    if (error) {

      const message = await readFunctionError(

        error,

        "Payment was received, but the designer registration could not be saved."

      );

      throw new Error(message);

    }

    if (!data?.success) {

      throw new Error(

        data?.message ||

          "Payment was received, but the designer registration could not be saved."

      );

    }

    setDesignerPaymentStage("success");

    setDesignerSubmitSuccess(true);

    setDesignerSubmitMessage(

      "Payment confirmed. Designer registration submitted successfully."

    );

    setDesignerFormData(initialDesignerFormData);

    setDesignerSerialSeed("");

    setDesignerPaymentExternalReference("");

  };

  const waitForDesignerPayment = async (externalReference) => {

    for (let attempt = 0; attempt < 40; attempt += 1) {

      const payment = await checkPayment(externalReference);

      if (payment?.status === "paid") {

        await finalizeDesignerApplication(externalReference);

        return "paid";

      }

      if (payment?.status === "failed") {

        setDesignerPaymentStage("failed");

        setDesignerPaymentExternalReference("");

        setDesignerSubmitSuccess(false);

        setDesignerSubmitMessage(

          payment?.message ||

            "Payment was not completed. Your designer registration was not submitted. You can try again."

        );

        return "failed";

      }

      await sleep(3000);

    }

    setDesignerPaymentStage("pending");

    setDesignerSubmitSuccess(false);

    setDesignerSubmitMessage(

      "Payment is still pending. If you approved the M-Pesa prompt, click Check Payment Status. Do not pay again."

    );

    return "pending";

  };

  const resumeDesignerPaymentCheck = async () => {

    if (!designerPaymentExternalReference || designerIsSubmitting) return;

    setDesignerIsSubmitting(true);

    setDesignerSubmitMessage("Checking your M-Pesa payment...");

    setDesignerSubmitSuccess(false);

    try {

      const payment = await checkPayment(designerPaymentExternalReference);

      if (payment?.status === "paid") {

        await finalizeDesignerApplication(designerPaymentExternalReference);

      } else if (payment?.status === "failed") {

        setDesignerPaymentStage("failed");

        setDesignerPaymentExternalReference("");

        setDesignerSubmitMessage(

          payment?.message ||

            "Payment was not completed. Your designer registration was not submitted. You can try again."

        );

      } else {

        setDesignerPaymentStage("pending");

        setDesignerSubmitMessage(

          "Payment is still pending. Do not start another payment yet."

        );

      }

    } catch (error) {

      console.error("Designer payment status error:", error);

      setDesignerPaymentStage("pending");

      setDesignerSubmitMessage(

        error?.message ||

          "We could not confirm the payment yet. Please try checking again."

      );

    } finally {

      setDesignerIsSubmitting(false);

    }

  };

  const handleDesignerSubmit = async (event) => {

    event.preventDefault();

    if (designerIsSubmitting) return;

    if (

      designerPaymentStage === "pending" &&

      designerPaymentExternalReference

    ) {

      await resumeDesignerPaymentCheck();

      return;

    }

    if (!designerFormData.showcase.length) {

      setDesignerSubmitMessage(

        "Please select at least one category to showcase."

      );

      setDesignerSubmitSuccess(false);

      return;

    }

    setDesignerIsSubmitting(true);

    setDesignerSubmitMessage("");

    setDesignerSubmitSuccess(false);

    setDesignerPaymentStage("initiating");

    try {

      const { data, error } = await supabase.functions.invoke(

        "initiate-designer-payment",

        {

          body: {

            phone: designerFormData.phone.trim(),

            showcase: designerFormData.showcase,

          },

        }

      );

      if (error) {

        const message = await readFunctionError(

          error,

          "Unable to start the designer M-Pesa payment."

        );

        throw new Error(message);

      }

      if (!data?.externalReference) {

        throw new Error(

          data?.message || "PayHero did not return a payment reference."

        );

      }

      setDesignerPaymentExternalReference(data.externalReference);

      setDesignerPaymentStage("waiting");

      setDesignerSubmitMessage(

        "M-Pesa request sent. Check your phone and enter your M-Pesa PIN. Waiting for payment confirmation..."

      );

      await waitForDesignerPayment(data.externalReference);

    } catch (error) {

      console.error("Designer payment initiation error:", error);

      setDesignerPaymentStage("idle");

      setDesignerSubmitSuccess(false);

      setDesignerSubmitMessage(

        error?.message ||

          "We could not start the payment. Please check the phone number and try again."

      );

    } finally {

      setDesignerIsSubmitting(false);

    }

  };

  /* =========================================================

     EXHIBITOR PAYMENT FLOW

  ========================================================= */

  const finalizeExhibitorApplication = async (externalReference) => {

    setExhibitorPaymentStage("finalizing");

    setExhibitorSubmitMessage(

      "Payment confirmed. Registering your exhibitor space..."

    );

    const { data, error } = await supabase.functions.invoke(

      "finalize-exhibitor-application",

      {

        body: {

          externalReference,

          brandName: exhibitorFormData.brandName.trim(),

          productType: exhibitorFormData.productType.trim(),

          email: exhibitorFormData.email.trim(),

          phone: exhibitorFormData.phone.trim(),

          location: exhibitorFormData.location,

        },

      }

    );

    if (error) {

      const message = await readFunctionError(

        error,

        "Payment was received, but the exhibitor registration could not be saved."

      );

      throw new Error(message);

    }

    if (!data?.success) {

      throw new Error(

        data?.message ||

          "Payment was received, but the exhibitor registration could not be saved."

      );

    }

    setExhibitorPaymentStage("success");

    setExhibitorSubmitSuccess(true);

    setExhibitorSubmitMessage(

      "Payment confirmed. Exhibitor registration submitted successfully."

    );

    setExhibitorFormData(initialExhibitorFormData);

    setExhibitorPaymentExternalReference("");

  };

  const waitForExhibitorPayment = async (externalReference) => {

    for (let attempt = 0; attempt < 40; attempt += 1) {

      const payment = await checkPayment(externalReference);

      if (payment?.status === "paid") {

        await finalizeExhibitorApplication(externalReference);

        return "paid";

      }

      if (payment?.status === "failed") {

        setExhibitorPaymentStage("failed");

        setExhibitorPaymentExternalReference("");

        setExhibitorSubmitSuccess(false);

        setExhibitorSubmitMessage(

          payment?.message ||

            "Payment was not completed. Your exhibitor registration was not submitted. You can try again."

        );

        return "failed";

      }

      await sleep(3000);

    }

    setExhibitorPaymentStage("pending");

    setExhibitorSubmitSuccess(false);

    setExhibitorSubmitMessage(

      "Payment is still pending. If you approved the M-Pesa prompt, click Check Payment Status. Do not pay again."

    );

    return "pending";

  };

  const resumeExhibitorPaymentCheck = async () => {

    if (!exhibitorPaymentExternalReference || exhibitorIsSubmitting) return;

    setExhibitorIsSubmitting(true);

    setExhibitorSubmitMessage("Checking your M-Pesa payment...");

    setExhibitorSubmitSuccess(false);

    try {

      const payment = await checkPayment(exhibitorPaymentExternalReference);

      if (payment?.status === "paid") {

        await finalizeExhibitorApplication(exhibitorPaymentExternalReference);

      } else if (payment?.status === "failed") {

        setExhibitorPaymentStage("failed");

        setExhibitorPaymentExternalReference("");

        setExhibitorSubmitMessage(

          payment?.message ||

            "Payment was not completed. Your exhibitor registration was not submitted. You can try again."

        );

      } else {

        setExhibitorPaymentStage("pending");

        setExhibitorSubmitMessage(

          "Payment is still pending. Do not start another payment yet."

        );

      }

    } catch (error) {

      console.error("Exhibitor payment status error:", error);

      setExhibitorPaymentStage("pending");

      setExhibitorSubmitMessage(

        error?.message ||

          "We could not confirm the payment yet. Please try checking again."

      );

    } finally {

      setExhibitorIsSubmitting(false);

    }

  };

  const handleExhibitorSubmit = async (event) => {

    event.preventDefault();

    if (exhibitorIsSubmitting) return;

    if (

      exhibitorPaymentStage === "pending" &&

      exhibitorPaymentExternalReference

    ) {

      await resumeExhibitorPaymentCheck();

      return;

    }

    setExhibitorIsSubmitting(true);

    setExhibitorSubmitMessage("");

    setExhibitorSubmitSuccess(false);

    setExhibitorPaymentStage("initiating");

    try {

      const { data, error } = await supabase.functions.invoke(

        "initiate-exhibitor-payment",

        {

          body: {

            phone: exhibitorFormData.phone.trim(),

          },

        }

      );

      if (error) {

        const message = await readFunctionError(

          error,

          "Unable to start the exhibitor M-Pesa payment."

        );

        throw new Error(message);

      }

      if (!data?.externalReference) {

        throw new Error(

          data?.message || "PayHero did not return a payment reference."

        );

      }

      setExhibitorPaymentExternalReference(data.externalReference);

      setExhibitorPaymentStage("waiting");

      setExhibitorSubmitMessage(

        "M-Pesa request sent. Check your phone and enter your M-Pesa PIN. Waiting for payment confirmation..."

      );

      await waitForExhibitorPayment(data.externalReference);

    } catch (error) {

      console.error("Exhibitor payment initiation error:", error);

      setExhibitorPaymentStage("idle");

      setExhibitorSubmitSuccess(false);

      setExhibitorSubmitMessage(

        error?.message ||

          "We could not start the payment. Please check the phone number and try again."

      );

    } finally {

      setExhibitorIsSubmitting(false);

    }

  };

  const exhibitorSubmitButtonText = (() => {

    if (exhibitorPaymentStage === "initiating") return "Sending M-Pesa Prompt...";

    if (exhibitorPaymentStage === "waiting") return "Waiting for Payment...";

    if (exhibitorPaymentStage === "finalizing") return "Submitting Registration...";

    if (exhibitorPaymentStage === "pending") return "Check Payment Status";

    if (exhibitorPaymentStage === "success") return "Registration Submitted";

    return `Pay KSh ${EXHIBITOR_FEE.toLocaleString("en-KE")} & Register`;

  })();

  const designerSubmitButtonText = (() => {

    if (designerPaymentStage === "initiating") return "Sending M-Pesa Prompt...";

    if (designerPaymentStage === "waiting") return "Waiting for Payment...";

    if (designerPaymentStage === "finalizing") return "Submitting Registration...";

    if (designerPaymentStage === "pending") return "Check Payment Status";

    if (designerPaymentStage === "success") return "Registration Submitted";

    if (!designerTotal) return "Select What You Will Showcase";

    return `Pay KSh ${designerTotal.toLocaleString("en-KE")} & Register`;

  })();

  const submitButtonText = (() => {

    if (paymentStage === "initiating") return "Sending M-Pesa Prompt...";

    if (paymentStage === "waiting") return "Waiting for Payment...";

    if (paymentStage === "finalizing") return "Submitting Application...";

    if (paymentStage === "pending") return "Check Payment Status";

    if (paymentStage === "success") return "Application Submitted";

    return "Pay KSh 1,000 & Submit";

  })();

  /* =========================================================

     AWARD VOTING PAYMENT FLOW

  ========================================================= */

  const handleAwardVote = (category) => {

    const contestantId =
      category === "male"
        ? selectedMaleContestant
        : selectedFemaleContestant;

    const contestants =
      category === "male"
        ? maleAwardContestants
        : femaleAwardContestants;

    const contestant = contestants.find(
      (item) => item.id === contestantId
    );

    if (!contestant) {

      setAwardVoteMessage("Please select a contestant first.");

      return;

    }

    setAwardVoteContestant(contestant);

    setAwardVotePhone("");

    setAwardVotePaymentStage("idle");

    setAwardVoteExternalReference("");

    setAwardVotePaymentMessage("");

    setAwardVoteMessage("");

    setAwardVoteModalOpen(true);

  };

  const handleAwardVoteModalClose = () => {

    if (awardVoteIsSubmitting) return;

    setAwardVoteModalOpen(false);

    setAwardVotePaymentMessage("");

  };

  const refreshAwardContestants = async () => {

    const { data, error } = await supabase

      .from("award_contestants")

      .select(
        "id,award_category,contestant_name,contestant_slug,display_order,vote_count,is_active"
      )

      .eq("is_active", true)

      .order("display_order", { ascending: true });

    if (error) {

      console.error("Unable to refresh award vote counts:", error);

      return;

    }

    setAwardContestants(data || []);

  };

  const finalizeAwardVote = async (externalReference) => {

    setAwardVotePaymentStage("finalizing");

    setAwardVotePaymentMessage(
      "Payment confirmed. Counting your vote..."
    );

    const { data, error } = await supabase.functions.invoke(

      "finalize-award-vote",

      {

        body: {

          externalReference,

        },

      }

    );

    if (error) {

      const message = await readFunctionError(

        error,

        "Payment was received, but the vote could not be counted."

      );

      throw new Error(message);

    }

    if (!data?.success) {

      throw new Error(
        data?.message ||
          "Payment was received, but the vote could not be counted."
      );

    }

    if (data?.contestant?.id) {

      setAwardContestants((current) =>
        current.map((contestant) =>
          contestant.id === data.contestant.id
            ? {
                ...contestant,
                vote_count: data.contestant.vote_count,
              }
            : contestant
        )
      );

    } else {

      await refreshAwardContestants();

    }

    setAwardVotePaymentStage("success");

    setAwardVotePaymentMessage(
      `Payment confirmed. Your vote for ${
        data?.contestant?.contestant_name ||
        awardVoteContestant?.contestant_name ||
        "the selected contestant"
      } has been counted.`
    );

    setAwardVoteExternalReference("");

  };

  const waitForAwardVotePayment = async (externalReference) => {

    for (let attempt = 0; attempt < 40; attempt += 1) {

      const payment = await checkPayment(externalReference);

      if (payment?.status === "paid") {

        await finalizeAwardVote(externalReference);

        return "paid";

      }

      if (payment?.status === "failed") {

        setAwardVotePaymentStage("failed");

        setAwardVoteExternalReference("");

        setAwardVotePaymentMessage(
          payment?.message ||
            "Payment was not completed. Your vote was not counted. You can try again."
        );

        return "failed";

      }

      await sleep(3000);

    }

    setAwardVotePaymentStage("pending");

    setAwardVotePaymentMessage(
      "Payment is still pending. If you approved the M-Pesa prompt, click Check Payment Status. Do not pay again."
    );

    return "pending";

  };

  const resumeAwardVotePaymentCheck = async () => {

    if (
      !awardVoteExternalReference ||
      awardVoteIsSubmitting
    ) {
      return;
    }

    setAwardVoteIsSubmitting(true);

    setAwardVotePaymentMessage(
      "Checking your M-Pesa payment..."
    );

    try {

      const payment = await checkPayment(
        awardVoteExternalReference
      );

      if (payment?.status === "paid") {

        await finalizeAwardVote(
          awardVoteExternalReference
        );

      } else if (payment?.status === "failed") {

        setAwardVotePaymentStage("failed");

        setAwardVoteExternalReference("");

        setAwardVotePaymentMessage(
          payment?.message ||
            "Payment was not completed. Your vote was not counted. You can try again."
        );

      } else {

        setAwardVotePaymentStage("pending");

        setAwardVotePaymentMessage(
          "Payment is still pending. Do not start another payment yet."
        );

      }

    } catch (error) {

      console.error(
        "Award vote payment status error:",
        error
      );

      setAwardVotePaymentStage("pending");

      setAwardVotePaymentMessage(
        error?.message ||
          "We could not confirm the payment yet. Please try checking again."
      );

    } finally {

      setAwardVoteIsSubmitting(false);

    }

  };

  const handleAwardVotePaymentSubmit = async (event) => {

    event.preventDefault();

    if (awardVoteIsSubmitting) return;

    if (
      awardVotePaymentStage === "pending" &&
      awardVoteExternalReference
    ) {

      await resumeAwardVotePaymentCheck();

      return;

    }

    if (!awardVoteContestant?.id) {

      setAwardVotePaymentMessage(
        "Please select a contestant first."
      );

      return;

    }

    if (!awardVotePhone.trim()) {

      setAwardVotePaymentMessage(
        "Enter the Safaricom number that should receive the M-Pesa prompt."
      );

      return;

    }

    setAwardVoteIsSubmitting(true);

    setAwardVotePaymentMessage("");

    setAwardVotePaymentStage("initiating");

    try {

      const { data, error } = await supabase.functions.invoke(

        "initiate-award-vote",

        {

          body: {

            phone: awardVotePhone.trim(),

            contestantId: awardVoteContestant.id,

          },

        }

      );

      if (error) {

        const message = await readFunctionError(

          error,

          "Unable to start the M-Pesa voting payment."

        );

        throw new Error(message);

      }

      if (!data?.externalReference) {

        throw new Error(
          data?.message ||
            "PayHero did not return a voting payment reference."
        );

      }

      setAwardVoteExternalReference(
        data.externalReference
      );

      setAwardVotePaymentStage("waiting");

      setAwardVotePaymentMessage(
        "M-Pesa request sent. Check the phone and enter the M-Pesa PIN. Waiting for payment confirmation..."
      );

      await waitForAwardVotePayment(
        data.externalReference
      );

    } catch (error) {

      console.error(
        "Award vote payment initiation error:",
        error
      );

      setAwardVotePaymentStage("idle");

      setAwardVotePaymentMessage(
        error?.message ||
          "We could not start the voting payment. Please check the phone number and try again."
      );

    } finally {

      setAwardVoteIsSubmitting(false);

    }

  };

  const awardVoteSubmitButtonText = (() => {

    if (awardVotePaymentStage === "initiating") {
      return "Sending M-Pesa Prompt...";
    }

    if (awardVotePaymentStage === "waiting") {
      return "Waiting for Payment...";
    }

    if (awardVotePaymentStage === "finalizing") {
      return "Counting Vote...";
    }

    if (awardVotePaymentStage === "pending") {
      return "Check Payment Status";
    }

    if (awardVotePaymentStage === "success") {
      return "Vote Counted";
    }

    return `Send M-Pesa Prompt · KSh ${AWARD_VOTE_FEE}`;

  })();

  return (

    <>

      {/* =====================================================

          NAVIGATION

      ====================================================== */}

      <nav ref={navRef} id="nav">

        <a

          href="#"

          className="logo"

          onClick={() => setMenuOpen(false)}

        >

          <span className="logo-mark">

            <img

              src={logo}

              alt="Face Off Agencies Kenya"

            />

          </span>

          <span className="logo-text">

            <strong>FACE OFF</strong>

            <em>Agencies Kenya</em>

          </span>

        </a>

        <ul

          className={`nav-links ${

            menuOpen ? "open" : ""

          }`}

        >

          <li>

            <a

              href="#efwa"

              onClick={() => setMenuOpen(false)}

            >

              About EFWA

            </a>

          </li>

          <li>

            <a

              href="#experience"

              onClick={() => setMenuOpen(false)}

            >

              Experience

            </a>

          </li>

          <li>

            <a

              href="#apply"

              onClick={() => setMenuOpen(false)}

            >

              Model Apply

            </a>

          </li>

          <li>

            <a

              href="#designers"

              onClick={() => setMenuOpen(false)}

            >

              Designer Apply

            </a>

          </li>

          <li>

            <a

              href="#exhibitors"

              onClick={() => setMenuOpen(false)}

            >

              Exhibitor Apply

            </a>

          </li>

          <li>

            <a

              href="#contact"

              onClick={() => setMenuOpen(false)}

            >

              Contact

            </a>

          </li>

          <li className="mobile-book-item">

            <a

              href="#contact"

              className="mobile-book"

              onClick={() => setMenuOpen(false)}

            >

              Book Us

            </a>

          </li>

        </ul>

        <div className="nav-actions">

          <a

            href="#contact"

            className="nav-cta"

          >

            Book Us

          </a>

          <button

            className={`menu-toggle ${

              menuOpen ? "active" : ""

            }`}

            onClick={() => setMenuOpen(!menuOpen)}

            aria-label="Toggle navigation menu"

            aria-expanded={menuOpen}

          >

            <span></span>

            <span></span>

          </button>

        </div>

      </nav>

      {/* =====================================================

          HERO

      ====================================================== */}

      <section className="hero">

        <img

          src={efwaLogo}

          alt=""

          className="hero-bg-image"

        />

        <div className="hero-overlay" />

        <div className="hero-content">

          <span className="hero-tag">

            Talent · Modeling · Media — Nairobi, Kenya

          </span>

          <h1>

            Your Face.

            <br />

            Our Platform.

            <br />

            One Runway.

          </h1>

          <p>

            Face Off Agencies Kenya sources, trains, and

            places models, brand ambassadors, and event

            talent across the country, while producing the

            marketing and media that puts them in front of

            the right audience. From casting calls to

            campaign day, we run the whole show.

          </p>

          <div className="hero-actions">

            <a

              href="#apply"

              className="btn-p"

            >

              Apply as a Model

            </a>

            <a

              href="#efwa"

              className="btn-g"

            >

              Discover EFWA{" "}

              <span className="arr">→</span>

            </a>

          </div>

        </div>

      </section>

      {/* =====================================================

          EMBU FASHION WEEKEND & AWARDS

      ====================================================== */}

      <section

        className="efwa-story"

        id="efwa"

      >

        <img

          src={efwaLogo}

          alt=""

          className="efwa-watermark"

          aria-hidden="true"

        />

        {/* EVENT INTRODUCTION */}

        <div className="efwa-heading reveal">

          <span className="efwa-kicker">

            Embu · Kenya · 1st Edition

          </span>

          <h2 className="efwa-title">

            Embu Fashion

            <br />

            Weekend &amp; Awards

          </h2>

          <p className="efwa-tagline">

            Creative &amp; Performing Arts into Sustainable

            Talentpreneurship

          </p>

        </div>

        <div className="efwa-intro-grid reveal">

          <div className="efwa-copy">

            <p className="efwa-lead">

              The{" "}

              <strong>

                1st Edition of Embu Fashion Weekend &amp;

                Awards

              </strong>{" "}

              is a family-friendly, multidisciplinary

              creative economy and lifestyle platform

              celebrating the talent, creativity, and

              entrepreneurial potential of the Mt. Kenya

              region.

            </p>

            <p>

              Hosted at Winter Villa Hotel Resort, the

              one-day-to-night experience brings together

              fashion, music, art, lifestyle, and hospitality

              in one vibrant platform.

            </p>

            <p>

              Guests will experience a{" "}

              <strong>

                High Fashion runway showcase

              </strong>{" "}

              featuring emerging and established fashion

              designers from the Mt. Kenya region,{" "}

              <strong>

                live music performances

              </strong>

              , an{" "}

              <strong>

                art exhibition by Nakuru Art Gallery

              </strong>

              , <strong>wine tasting</strong>, and an

              open-air{" "}

              <strong>

                meet-and-greet experience with an open bar

              </strong>

              .

            </p>

            <p>

              Beyond entertainment, Embu Fashion Weekend

              &amp; Awards provides a platform for creatives

              and performing artists to showcase their work,

              build meaningful connections, access new

              audiences, and explore creative entrepreneurship

              as a sustainable career pathway.

            </p>

          </div>

          <div className="efwa-feature-media">

            <img

              src={image1}

              alt="High fashion runway experience at Embu Fashion Weekend"

            />

            <div className="efwa-image-caption">



            </div>

          </div>

        </div>

        {/* ===================================================

            WHAT TO EXPECT

        ==================================================== */}

        <div

          className="efwa-experience"

          id="experience"

        >

          <div className="experience-heading reveal">

            <div>

              <span className="efwa-kicker">

                The Experience

              </span>

              <h3>

                What to Expect

              </h3>

            </div>

            <p>

              A one-day-to-night celebration bringing

              fashion, performing arts, lifestyle,

              hospitality, creative business and culture

              together in one destination.

            </p>

          </div>

          <div className="experience-grid reveal">

            <article className="experience-card">

              <h4>

                High Fashion

                <br />

                Runway Showcase

              </h4>

              <p>

                Emerging and established designers from the

                Mt. Kenya region take centre stage.

              </p>

            </article>

            <article className="experience-card">

              <h4>

                Live Music &amp;

                <br />

                Performing Arts

              </h4>

              <p>

                Live performances bringing music, movement

                and creative expression into the experience.

              </p>

            </article>

            <article className="experience-card">

              <h4>

                Art Exhibition

              </h4>

              <p>

                A curated art experience presented by

                Nakuru Art Gallery.

              </p>

            </article>

            <article className="experience-card">

              <h4>

                Wine Tasting

              </h4>

              <p>

                A relaxed tasting experience integrated

                into the event&apos;s lifestyle programme.

              </p>

            </article>

            <article className="experience-card">

              <h4>

                Open Bar &amp;

                <br />

                Lifestyle Experience

              </h4>

              <p>

                An open-air hospitality experience designed

                around conversation, music and atmosphere.

              </p>

            </article>

            <article className="experience-card">

              <h4>

                Meet &amp; Greet

                <br />

                &amp; Networking

              </h4>

              <p>

                A space for creatives, guests, brands and

                industry players to meet and connect.

              </p>

            </article>

            <article className="experience-card">

              <h4>

                Fashion &amp;

                <br />

                Creative Arts Awards

              </h4>

              <p>

                Recognition of creative talent and

                contribution across the regional creative

                economy.

              </p>

            </article>

            <article className="experience-card">

              <h4>

                Emerging &amp;

                <br />

                Established Talent

              </h4>

              <p>

                A shared platform for new voices and

                established creatives to reach wider

                audiences.

              </p>

            </article>

          </div>

        </div>

        {/* ===================================================

            EXPERIENCE GALLERY

        ==================================================== */}

        <div className="efwa-gallery reveal">

          <figure className="efwa-gallery-card">

            <img

              src={image2}

              alt="Live music and performing arts experience"

            />

            <figcaption>

              <span>Performance</span>

              Live Music &amp; Performing Arts

            </figcaption>

          </figure>

          <figure className="efwa-gallery-card">

            <img

              src={image3}

              alt="Art exhibition and creative arts"

            />

            <figcaption>

              <span>Art</span>

              Nakuru Art Gallery Exhibition

            </figcaption>

          </figure>

          <figure className="efwa-gallery-card">

            <img

              src={image4}

              alt="Lifestyle and hospitality experience"

            />

            <figcaption>

              <span>Lifestyle</span>

              Hospitality · Networking · Experience

            </figcaption>

          </figure>

        </div>

      </section>

      {/* =====================================================

          MODEL APPLICATION SECTION

      ====================================================== */}

      <section

        className="model-apply-section"

        id="apply"

      >

        <img

          src={efwaLogo}

          alt=""

          className="model-apply-watermark"

          aria-hidden="true"

        />

        <div className="model-apply-grid reveal">

          <div className="model-apply-inner">

            <span className="model-apply-kicker">

              Model Applications

            </span>

            <h2 className="model-apply-title">

              Think You Belong

              <br />

              On The Runway?

            </h2>

            <p className="model-apply-description">

              Apply to join Face Off Agencies Kenya and be

              considered for modelling, fashion shows,

              advertising campaigns, brand activations and

              upcoming opportunities.

            </p>

            <button

              type="button"

              className="btn-p model-apply-button"

              onClick={handleApplicationOpen}

            >

              Apply Now

            </button>

            <p className="model-apply-note">

              Applications are reviewed by our casting team.

            </p>

          </div>

          <div className="model-apply-media">

            <img

              src={image6}

              alt="Model on the runway at Face Off Agencies Kenya"

            />

          </div>

        </div>

      </section>

      {/* =====================================================

          MODEL APPLICATION POPUP

      ====================================================== */}

      {applicationOpen && (

        <div

          className="application-modal-backdrop"

          onMouseDown={(event) => {

            if (

              event.target === event.currentTarget

            ) {

              handleApplicationClose();

            }

          }}

        >

          <div

            className="application-modal"

            role="dialog"

            aria-modal="true"

            aria-labelledby="application-title"

          >

            {/* CLOSE BUTTON */}

            <button

              type="button"

              className="application-close"

              onClick={handleApplicationClose}

              aria-label="Close model application form"

            >

              ×

            </button>

            {/* FORM HEADER */}

            <div className="application-header">

              <img

                src={efwaLogo}

                alt="Embu Fashion Weekend & Awards"

                className="application-logo"

              />

              <span className="application-kicker">

                Face Off Agencies Kenya

              </span>

              <h2 id="application-title">

                Model Application

              </h2>

              <p>

                Complete your details below to be considered

                for upcoming modelling opportunities.

              </p>

            </div>

            {/* =================================================

                APPLICATION FORM

            ================================================== */}

            <form

              className="application-form"

              onSubmit={handleSubmit}

            >

              {/* FULL NAME */}

              <div className="form-group form-group-full">

                <label htmlFor="fullName">

                  Full Name

                </label>

                <input

                  type="text"

                  id="fullName"

                  name="fullName"

                  value={formData.fullName}

                  onChange={handleInputChange}

                  placeholder="Enter your full name"

                  autoComplete="name"

                  disabled={isSubmitting}

                  required

                />

              </div>

              {/* PHONE */}

              <div className="form-group">

                <label htmlFor="phone">

                  Phone

                </label>

                <input

                  type="tel"

                  id="phone"

                  name="phone"

                  value={formData.phone}

                  onChange={handleInputChange}

                  placeholder="0712345678, 0112345678, or +254712345678"

                  autoComplete="tel"

                  disabled={isSubmitting}

                  required

                />

                <span className="form-help">

                  The M-Pesa STK Push will be sent to this number.

                </span>

              </div>

              {/* EMAIL */}

              <div className="form-group">

                <label htmlFor="email">

                  Email

                </label>

                <input

                  type="email"

                  id="email"

                  name="email"

                  value={formData.email}

                  onChange={handleInputChange}

                  placeholder="name@example.com"

                  autoComplete="email"

                  disabled={isSubmitting}

                  required

                />

              </div>

              {/* AGE */}

              <div className="form-group">

                <label htmlFor="age">

                  Age

                </label>

                <input

                  type="number"

                  id="age"

                  name="age"

                  value={formData.age}

                  onChange={handleInputChange}

                  placeholder="Enter your age"

                  inputMode="numeric"

                  min={MINIMUM_AGE}

                  disabled={isSubmitting}

                  required

                />

                <span className="form-help">

                  You must be at least {MINIMUM_AGE} years old to apply.

                </span>

              </div>

              {/* GENDER */}

              <div className="form-group">

                <label htmlFor="gender">

                  Gender

                </label>

                <select

                  id="gender"

                  name="gender"

                  value={formData.gender}

                  onChange={handleInputChange}

                  disabled={isSubmitting}

                  required

                >

                  <option value="">

                    Select gender

                  </option>

                  <option value="Female">

                    Female

                  </option>

                  <option value="Male">

                    Male

                  </option>

                  <option value="Other">

                    Other

                  </option>

                  <option value="Prefer not to say">

                    Prefer not to say

                  </option>

                </select>

              </div>

              {/* CURRENT LOCATION */}

              <div className="form-group">

                <label htmlFor="location">

                  Current Location

                </label>

                <select

                  id="location"

                  name="location"

                  value={formData.location}

                  onChange={handleInputChange}

                  disabled={isSubmitting}

                  required

                >

                  <option value="">

                    Select county

                  </option>

                  {KENYAN_COUNTIES.map((county) => (

                    <option key={county} value={county}>

                      {county}

                    </option>

                  ))}

                </select>

              </div>

              {/* HEIGHT */}

              <div className="form-group">

                <label htmlFor="height">

                  Height

                </label>

                <div className="height-input-wrapper">

                  <input

                    type="number"

                    id="height"

                    name="height"

                    value={formData.height}

                    onChange={handleInputChange}

                    placeholder="Height"

                    step="0.1"

                    inputMode="decimal"

                    disabled={isSubmitting}

                    required

                  />

                  <span className="height-unit">

                    cm

                  </span>

                </div>

              </div>

              {/* PHOTO UPLOAD */}

              <div className="form-group form-group-full">

                <label htmlFor="photo">

                  Photo

                </label>

                <div className="photo-upload">

                  <input

                    type="file"

                    id="photo"

                    name="photo"

                    accept="image/*"

                    onChange={handlePhotoChange}

                    disabled={isSubmitting}

                    className="photo-input"

                  />

                  {photoPreview ? (

                    <div className="photo-preview">

                      <img src={photoPreview} alt="Selected preview" />

                      <button

                        type="button"

                        className="photo-remove"

                        onClick={handlePhotoRemove}

                        disabled={isSubmitting}

                      >

                        Remove

                      </button>

                    </div>

                  ) : (

                    <label htmlFor="photo" className="photo-dropzone">

                      <span>Click to upload a photo</span>

                      <span className="photo-hint">JPG or PNG, up to 5MB</span>

                    </label>

                  )}

                </div>

              </div>

              {/* PAYMENT SUMMARY */}

              <div className="payment-summary form-group-full">

                <div>

                  <span className="payment-summary-label">Application Fee</span>

                  <strong>KSh 1,000</strong>

                </div>

                <p>

                  You will receive an M-Pesa STK Push on the phone number above.


                </p>

                {paymentExternalReference && (

                  <span className="payment-reference">

                    Payment reference: {paymentExternalReference}

                  </span>

                )}

              </div>

              {/* =================================================

                  SUBMIT BUTTON

              ================================================== */}

              <div className="application-submit">

                <button

                  type="submit"

                  className="btn-p application-submit-button"

                  disabled={isSubmitting || paymentStage === "success"}

                >

                  {submitButtonText}

                </button>

                {submitMessage && (

                  <p

                    className={`application-message ${

                      submitSuccess

                        ? "success"

                        : [

                            "initiating",

                            "waiting",

                            "pending",

                            "finalizing",

                          ].includes(paymentStage)

                        ? "pending"

                        : "error"

                    }`}

                  >

                    {submitMessage}

                  </p>

                )}

              </div>

            </form>

          </div>

        </div>

      )}

      {/* =====================================================

          DESIGNER REGISTRATION SECTION

      ====================================================== */}

      <section

        className="model-apply-section"

        id="designers"

      >

        <img

          src={efwaLogo}

          alt=""

          className="model-apply-watermark"

          aria-hidden="true"

        />

        <div className="model-apply-grid reveal">

          <div className="model-apply-media">

            <img

              src={image8}

              alt="Designer showcase at Embu Fashion Weekend & Awards"

            />

          </div>

          <div className="model-apply-inner">

            <span className="model-apply-kicker">

              Designer Applications

            </span>

            <h2 className="model-apply-title">

              Put Your Brand

              <br />

              On The Runway

            </h2>

            <p className="model-apply-description">

              Register to showcase your fashion brand at Embu Fashion

              Weekend &amp; Awards. Designers can present ladies' clothes,

              men's clothes, bags, shoes, or combine several categories.

            </p>

            <button

              type="button"

              className="btn-p model-apply-button"

              onClick={handleDesignerOpen}

            >

              Register as a Designer

            </button>

            <p className="model-apply-note">

              Select your showcase categories and the fee is calculated automatically.

            </p>

          </div>

        </div>

      </section>

      {/* =====================================================

          DESIGNER REGISTRATION POPUP

      ====================================================== */}

      {designerOpen && (

        <div

          className="application-modal-backdrop"

          onMouseDown={(event) => {

            if (event.target === event.currentTarget) {

              handleDesignerClose();

            }

          }}

        >

          <div

            className="application-modal"

            role="dialog"

            aria-modal="true"

            aria-labelledby="designer-application-title"

          >

            <button

              type="button"

              className="application-close"

              onClick={handleDesignerClose}

              aria-label="Close designer registration form"

            >

              ×

            </button>

            <div className="application-header">

              <img

                src={efwaLogo}

                alt="Embu Fashion Weekend & Awards"

                className="application-logo"

              />

              <span className="application-kicker">

                Embu Fashion Weekend &amp; Awards

              </span>

              <h2 id="designer-application-title">

                Designer Registration

              </h2>

              <p>

                Register your brand, select what you will showcase, and pay

                the calculated participation fee through M-Pesa.

              </p>

            </div>

            <form

              className="application-form"

              onSubmit={handleDesignerSubmit}

            >

              <div className="form-group form-group-full">

                <label htmlFor="designerBrandName">

                  Brand Name

                </label>

                <input

                  type="text"

                  id="designerBrandName"

                  name="brandName"

                  value={designerFormData.brandName}

                  onChange={handleDesignerInputChange}

                  placeholder="Enter your brand name"

                  disabled={designerIsSubmitting}

                  required

                />

              </div>

              <div className="form-group">

                <label htmlFor="designerEmail">

                  Email Address

                </label>

                <input

                  type="email"

                  id="designerEmail"

                  name="email"

                  value={designerFormData.email}

                  onChange={handleDesignerInputChange}

                  placeholder="brand@example.com"

                  autoComplete="email"

                  disabled={designerIsSubmitting}

                  required

                />

              </div>

              <div className="form-group">

                <label htmlFor="designerPhone">

                  Phone Number

                </label>

                <input

                  type="tel"

                  id="designerPhone"

                  name="phone"

                  value={designerFormData.phone}

                  onChange={handleDesignerInputChange}

                  placeholder="0712345678, 0112345678, or +254712345678"

                  autoComplete="tel"

                  disabled={designerIsSubmitting}

                  required

                />

                <span className="form-help">

                  The M-Pesa STK Push will be sent to this number.

                </span>

              </div>

              <div className="form-group">

                <label htmlFor="designerLocation">

                  Location

                </label>

                <select

                  id="designerLocation"

                  name="location"

                  value={designerFormData.location}

                  onChange={handleDesignerInputChange}

                  disabled={designerIsSubmitting}

                  required

                >

                  <option value="">Select county</option>

                  {KENYAN_COUNTIES.map((county) => (

                    <option key={county} value={county}>

                      {county}

                    </option>

                  ))}

                </select>

              </div>

              <div className="form-group">

                <label htmlFor="designerSerialNumber">

                  Designer Serial Number

                </label>

                <input

                  type="text"

                  id="designerSerialNumber"

                  value={designerSerialNumber}

                  placeholder="Select showcase categories below"

                  readOnly

                />

                <span className="form-help">

                  Generated automatically from the categories selected.

                </span>

              </div>

              <div className="payment-summary form-group-full">

                <div>

                  <span className="payment-summary-label">

                    What Will You Showcase?

                  </span>

                  <strong>Select one or more</strong>

                </div>

                <p>

                  Ladies' and men's clothing share one KSh 10,000 clothing fee.

                  Bags are KSh 10,000 and shoes are KSh 7,500. You may select all.

                </p>

                <div

                  style={{

                    display: "grid",

                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",

                    gap: ".8rem",

                    marginTop: "1rem",

                  }}

                >

                  {DESIGNER_SHOWCASE_OPTIONS.map((option) => (

                    <label

                      key={option.value}

                      style={{

                        display: "flex",

                        alignItems: "center",

                        gap: ".65rem",

                        padding: ".75rem .85rem",

                        border: "1px solid var(--border)",

                        borderRadius: "10px",

                        cursor: "pointer",

                      }}

                    >

                      <input

                        type="checkbox"

                        value={option.value}

                        checked={designerFormData.showcase.includes(option.value)}

                        onChange={handleDesignerShowcaseChange}

                        disabled={designerIsSubmitting}

                        style={{

                          width: "18px",

                          height: "18px",

                          minHeight: "auto",

                          accentColor: "var(--accent)",

                          flexShrink: 0,

                        }}

                      />

                      <span>{option.label}</span>

                    </label>

                  ))}

                </div>

              </div>

              <div className="payment-summary form-group-full">

                <div>

                  <span className="payment-summary-label">

                    Showcase Fee

                  </span>

                  <strong>

                    KSh {designerTotal.toLocaleString("en-KE")}

                  </strong>

                </div>

                <p>

                  The amount is calculated automatically from your selections.

                  An M-Pesa prompt will be sent to the phone number above.

                </p>

                {designerPaymentExternalReference && (

                  <span className="payment-reference">

                    Payment reference: {designerPaymentExternalReference}

                  </span>

                )}

              </div>

              <div className="application-submit">

                <button

                  type="submit"

                  className="btn-p application-submit-button"

                  disabled={

                    designerIsSubmitting ||

                    designerPaymentStage === "success" ||

                    !designerTotal

                  }

                >

                  {designerSubmitButtonText}

                </button>

                {designerSubmitMessage && (

                  <p

                    className={`application-message ${

                      designerSubmitSuccess

                        ? "success"

                        : [

                            "initiating",

                            "waiting",

                            "pending",

                            "finalizing",

                          ].includes(designerPaymentStage)

                        ? "pending"

                        : "error"

                    }`}

                  >

                    {designerSubmitMessage}

                  </p>

                )}

              </div>

            </form>

          </div>

        </div>

      )}

      {/* =====================================================

          EXHIBITOR REGISTRATION SECTION

      ====================================================== */}

      <section

        className="model-apply-section"

        id="exhibitors"

      >

        <img

          src={efwaLogo}

          alt=""

          className="model-apply-watermark"

          aria-hidden="true"

        />

        <div className="model-apply-grid reveal">

          <div className="model-apply-inner">

            <span className="model-apply-kicker">

              Exhibitor Applications

            </span>

            <h2 className="model-apply-title">

              Showcase Your Brand

              <br />

              To A Vibrant Audience

            </h2>

            <p className="model-apply-description">

              Register as an exhibitor at Embu Fashion Weekend &amp; Awards and

              showcase your products while connecting with designers, buyers,

              fashion lovers and guests throughout the event.

            </p>

            <button

              type="button"

              className="btn-p model-apply-button"

              onClick={handleExhibitorOpen}

            >

              Register as an Exhibitor

            </button>



          </div>

          <div className="model-apply-media">

            <img

              src={image9}

              alt="Exhibitors call for Embu Fashion Weekend & Awards"

            />

          </div>

        </div>

      </section>

      {/* =====================================================

          EXHIBITOR REGISTRATION POPUP

      ====================================================== */}

      {exhibitorOpen && (

        <div

          className="application-modal-backdrop"

          onMouseDown={(event) => {

            if (event.target === event.currentTarget) {

              handleExhibitorClose();

            }

          }}

        >

          <div

            className="application-modal"

            role="dialog"

            aria-modal="true"

            aria-labelledby="exhibitor-application-title"

          >

            <button

              type="button"

              className="application-close"

              onClick={handleExhibitorClose}

              aria-label="Close exhibitor registration form"

            >

              ×

            </button>

            <div className="application-header">

              <img

                src={efwaLogo}

                alt="Embu Fashion Weekend & Awards"

                className="application-logo"

              />

              <span className="application-kicker">

                Embu Fashion Weekend &amp; Awards

              </span>

              <h2 id="exhibitor-application-title">

                Exhibitor Registration

              </h2>

              <p>

                Register your brand and product for an exhibition space. The

                KSh 5,000 exhibition fee will be prompted through M-Pesa.

              </p>

            </div>

            <form

              className="application-form"

              onSubmit={handleExhibitorSubmit}

            >

              <div className="form-group form-group-full">

                <label htmlFor="exhibitorBrandName">

                  Brand Name

                </label>

                <input

                  type="text"

                  id="exhibitorBrandName"

                  name="brandName"

                  value={exhibitorFormData.brandName}

                  onChange={handleExhibitorInputChange}

                  placeholder="Enter your brand name"

                  disabled={exhibitorIsSubmitting}

                  required

                />

              </div>

              <div className="form-group form-group-full">

                <label htmlFor="exhibitorProductType">

                  Type of Product

                </label>

                <input

                  type="text"

                  id="exhibitorProductType"

                  name="productType"

                  value={exhibitorFormData.productType}

                  onChange={handleExhibitorInputChange}

                  placeholder="e.g. Jewellery, beauty products, accessories, food"

                  disabled={exhibitorIsSubmitting}

                  required

                />

              </div>

              <div className="form-group">

                <label htmlFor="exhibitorEmail">

                  Email Address

                </label>

                <input

                  type="email"

                  id="exhibitorEmail"

                  name="email"

                  value={exhibitorFormData.email}

                  onChange={handleExhibitorInputChange}

                  placeholder="brand@example.com"

                  autoComplete="email"

                  disabled={exhibitorIsSubmitting}

                  required

                />

              </div>

              <div className="form-group">

                <label htmlFor="exhibitorPhone">

                  Phone Number

                </label>

                <input

                  type="tel"

                  id="exhibitorPhone"

                  name="phone"

                  value={exhibitorFormData.phone}

                  onChange={handleExhibitorInputChange}

                  placeholder="0712345678, 0112345678, or +254712345678"

                  autoComplete="tel"

                  disabled={exhibitorIsSubmitting}

                  required

                />

                <span className="form-help">

                  The KSh 5,000 M-Pesa STK Push will be sent to this number.

                </span>

              </div>

              <div className="form-group form-group-full">

                <label htmlFor="exhibitorLocation">

                  Location

                </label>

                <select

                  id="exhibitorLocation"

                  name="location"

                  value={exhibitorFormData.location}

                  onChange={handleExhibitorInputChange}

                  disabled={exhibitorIsSubmitting}

                  required

                >

                  <option value="">Select county</option>

                  {KENYAN_COUNTIES.map((county) => (

                    <option key={county} value={county}>

                      {county}

                    </option>

                  ))}

                </select>

              </div>

              <div className="payment-summary form-group-full">

                <div>

                  <span className="payment-summary-label">

                    Exhibition Fee

                  </span>

                  <strong>

                    KSh {EXHIBITOR_FEE.toLocaleString("en-KE")}

                  </strong>

                </div>

                <p>

                  An M-Pesa prompt will be sent to the phone number above. Your

                  exhibitor information is submitted only after payment is confirmed.

                </p>

                {exhibitorPaymentExternalReference && (

                  <span className="payment-reference">

                    Payment reference: {exhibitorPaymentExternalReference}

                  </span>

                )}

              </div>

              <div className="application-submit">

                <button

                  type="submit"

                  className="btn-p application-submit-button"

                  disabled={

                    exhibitorIsSubmitting ||

                    exhibitorPaymentStage === "success"

                  }

                >

                  {exhibitorSubmitButtonText}

                </button>

                {exhibitorSubmitMessage && (

                  <p

                    className={`application-message ${

                      exhibitorSubmitSuccess

                        ? "success"

                        : [

                            "initiating",

                            "waiting",

                            "pending",

                            "finalizing",

                          ].includes(exhibitorPaymentStage)

                        ? "pending"

                        : "error"

                    }`}

                  >

                    {exhibitorSubmitMessage}

                  </p>

                )}

              </div>

            </form>

          </div>

        </div>

      )}

      {/* =====================================================

          EMBU FASHION AWARDS VOTING

      ====================================================== */}

      <section className="awards-voting-section" id="awards-voting">
        <div className="awards-voting-heading reveal">
          <span className="awards-voting-kicker">
            Embu Fashion Awards 2026
          </span>

          <h2>
            Vote For Your
            <br />
            Favourite Model
          </h2>

          <p>
            Choose one contestant, then cast your vote for KSh {AWARD_VOTE_FEE}.
            A vote will only be added after the M-Pesa payment is confirmed.
          </p>
        </div>

        <div className="awards-voting-grid reveal">
          <article className="award-vote-panel">
            <div className="award-vote-image">
              <img
                src={imageF}
                alt="Embu Fashion Awards Best Male Model of the Year 2026 trophy"
              />
            </div>

            <div className="award-vote-content">
              <span className="award-vote-label">Male Category</span>

              <h3>Best Male Model of the Year 2026</h3>

              <p className="award-vote-instruction">
                Select one contestant. Each confirmed vote costs KSh {AWARD_VOTE_FEE}.
              </p>

              <div className="award-contestants">
                {maleAwardContestants.map((contestant) => {
                  const selected = selectedMaleContestant === contestant.id;

                  return (
                    <button
                      key={contestant.id}
                      type="button"
                      className={`award-contestant ${selected ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedMaleContestant(contestant.id);
                        setAwardVoteMessage("");
                      }}
                      aria-pressed={selected}
                    >
                      <span className="award-contestant-check" aria-hidden="true">
                        {selected ? "✓" : ""}
                      </span>

                      <span className="award-contestant-name">
                        {contestant.contestant_name}
                      </span>

                      <span className="award-contestant-votes">
                        <strong>{contestant.vote_count || 0}</strong>
                        <small>votes</small>
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="btn-p award-vote-button"
                disabled={!selectedMaleContestant}
                onClick={() => handleAwardVote("male")}
              >
                Vote KSh {AWARD_VOTE_FEE}
              </button>
            </div>
          </article>

          <article className="award-vote-panel">
            <div className="award-vote-image">
              <img
                src={imageG}
                alt="Embu Fashion Awards Best Female Model of the Year 2026 trophy"
              />
            </div>

            <div className="award-vote-content">
              <span className="award-vote-label">Female Category</span>

              <h3>Best Female Model of the Year 2026</h3>

              <p className="award-vote-instruction">
                Select one contestant. Each confirmed vote costs KSh {AWARD_VOTE_FEE}.
              </p>

              <div className="award-contestants">
                {femaleAwardContestants.map((contestant) => {
                  const selected = selectedFemaleContestant === contestant.id;

                  return (
                    <button
                      key={contestant.id}
                      type="button"
                      className={`award-contestant ${selected ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedFemaleContestant(contestant.id);
                        setAwardVoteMessage("");
                      }}
                      aria-pressed={selected}
                    >
                      <span className="award-contestant-check" aria-hidden="true">
                        {selected ? "✓" : ""}
                      </span>

                      <span className="award-contestant-name">
                        {contestant.contestant_name}
                      </span>

                      <span className="award-contestant-votes">
                        <strong>{contestant.vote_count || 0}</strong>
                        <small>votes</small>
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="btn-p award-vote-button"
                disabled={!selectedFemaleContestant}
                onClick={() => handleAwardVote("female")}
              >
                Vote KSh {AWARD_VOTE_FEE}
              </button>
            </div>
          </article>
        </div>

        {awardVoteMessage && (
          <p className="award-vote-message reveal">
            {awardVoteMessage}
          </p>
        )}
      </section>

      {/* =====================================================

          AWARD VOTE M-PESA POPUP

      ====================================================== */}

      {awardVoteModalOpen && awardVoteContestant && (

        <div
          className="application-modal-backdrop"
          onMouseDown={(event) => {

            if (event.target === event.currentTarget) {

              handleAwardVoteModalClose();

            }

          }}
        >

          <div
            className="application-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="award-vote-payment-title"
          >

            <button
              type="button"
              className="application-close"
              onClick={handleAwardVoteModalClose}
              aria-label="Close voting payment form"
            >
              ×
            </button>

            <div className="application-header">

              <img
                src={efwaLogo}
                alt="Embu Fashion Weekend & Awards"
                className="application-logo"
              />

              <span className="application-kicker">
                Embu Fashion Awards 2026
              </span>

              <h2 id="award-vote-payment-title">
                Complete Your Vote
              </h2>

              <p>
                You are voting for{" "}
                <strong>
                  {awardVoteContestant.contestant_name}
                </strong>
                . Enter the Safaricom number that should receive the
                KSh {AWARD_VOTE_FEE} M-Pesa STK Push.
              </p>

            </div>

            <form
              className="application-form"
              onSubmit={handleAwardVotePaymentSubmit}
            >

              <div className="payment-summary form-group-full">

                <div>

                  <span className="payment-summary-label">
                    Voting Fee
                  </span>

                  <strong>
                    KSh {AWARD_VOTE_FEE}
                  </strong>

                </div>

                <p>
                  One successful KSh {AWARD_VOTE_FEE} payment counts as
                  one vote for the selected contestant.
                </p>

                {awardVoteExternalReference && (

                  <span className="payment-reference">
                    Payment reference: {awardVoteExternalReference}
                  </span>

                )}

              </div>

              <div className="form-group form-group-full">

                <label htmlFor="awardVotePhone">
                  M-Pesa Phone Number
                </label>

                <input
                  type="tel"
                  id="awardVotePhone"
                  name="awardVotePhone"
                  value={awardVotePhone}
                  onChange={(event) =>
                    setAwardVotePhone(event.target.value)
                  }
                  placeholder="0712345678, 0112345678, or +254712345678"
                  autoComplete="tel"
                  disabled={
                    awardVoteIsSubmitting ||
                    awardVotePaymentStage === "success"
                  }
                  required
                />

                <span className="form-help">
                  The M-Pesa STK Push will be sent to this number.
                  Safaricom numbers starting with 07, 01, or +254 are accepted.
                </span>

              </div>

              <div className="application-submit">

                <button
                  type="submit"
                  className="btn-p application-submit-button"
                  disabled={
                    awardVoteIsSubmitting ||
                    awardVotePaymentStage === "success"
                  }
                >
                  {awardVoteSubmitButtonText}
                </button>

                {awardVotePaymentMessage && (

                  <p
                    className={`application-message ${
                      awardVotePaymentStage === "success"
                        ? "success"
                        : [
                            "initiating",
                            "waiting",
                            "pending",
                            "finalizing",
                          ].includes(awardVotePaymentStage)
                        ? "pending"
                        : "error"
                    }`}
                  >
                    {awardVotePaymentMessage}
                  </p>

                )}

              </div>

            </form>

          </div>

        </div>

      )}

      {/* =====================================================

          EFWA CLOSING STATEMENT + PARTNERS

      ====================================================== */}

      <section className="efwa-closing-section">

        <div className="efwa-closing reveal">

          <div className="closing-label">

            More Than an Event

          </div>

          <h3>

            Talent. Creativity.

            <br />

            Culture. Business.

            <br />

            Opportunity.

          </h3>

          <p>

            <strong>

              Embu Fashion Weekend &amp; Awards

            </strong>{" "}

            is a platform designed to connect talent,

            creativity, culture, business, and opportunity,

            positioning the creative and performing arts as

            a viable pathway to sustainable talent

            entrepreneurship.

          </p>

  

          <div className="efwa-partners">

            <span className="partners-kicker">

              Our Partners

            </span>

            <div className="partners-logo-row">

              <div className="partner-logo-card">

                <img

                  src={imageA}

                  alt="EFWA partner logo 1"

                />

              </div>

              <div className="partner-logo-card">

                <img

                  src={imageB}

                  alt="EFWA partner logo 2"

                />

              </div>

              <div className="partner-logo-card">

                <img

                  src={imageC}

                  alt="EFWA partner logo 3"

                />

              </div>

              <div className="partner-logo-card">

                <img

                  src={imageD}

                  alt="EFWA partner logo 4"

                />

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* =====================================================

          FOOTER

      ====================================================== */}

      <footer id="contact">

        <div className="f-logo">

          <img

            src={logo}

            alt="Face Off Agencies Kenya"

          />

        </div>

        <p className="f-copy">

          © 2026 Face Off Agencies Kenya · Nairobi, Kenya

          <br />

          <a href="mailto:faceoffagencieske@gmail.com">

            faceoffagencieske@gmail.com

          </a>

        </p>

        <ul className="f-links">

          <li>


          </li>

          <li>


          </li>

          <li>



          </li>

        </ul>

      </footer>

    </>

  );

}
